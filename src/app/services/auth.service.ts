// src/app/services/auth.service.ts
import { Injectable, inject } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  getCountFromServer,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

// ---------------------------
// TYPES
// ---------------------------
export type SortOption = 'deadline' | 'subject' | 'completion';
export type TaskStatus = 'not started' | 'in progress' | 'completed';

export interface Task {
  id?: string;
  subject: string;
  status: TaskStatus;
  deadline: string;
  createdAt?: Date;
  updatedAt?: Date;
  priority?: 'low' | 'normal' | 'high';
  isOverdue?: boolean;
}

export interface AppUser {
  uid: string;
  email: string | null;
  name: string;
  bio?: string;
  avatar?: string;
  completedTasks?: number;
  totalTasks?: number;
  isPro?: boolean;

  // Add these fields
  course?: string;

  settings?: {
    darkMode?: boolean;
    offlineMode?: boolean;
    notifications?: { taskReminders?: boolean };
    taskPreferences?: { sortBy?: SortOption };
  };
}


// ---------------------------
// SERVICE
// ---------------------------
@Injectable({ providedIn: 'root' })
export class AuthService {
  // Firebase Auth & Firestore instances
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  // BehaviorSubject to keep track of current user
  private userSubject = new BehaviorSubject<AppUser | null>(null);
  public user$: Observable<AppUser | null> = this.userSubject.asObservable();

  constructor() {
    this.initAuthListener(); // Start listening to auth state changes
  } 

  // ---------------------------
  // AUTH SECTION
  // ---------------------------
  private initAuthListener() {
    // Fires whenever the user logs in/out
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        const profile = await this.loadUserProfile(user.uid);
        this.userSubject.next(profile); // Update current user
      } else {
        this.userSubject.next(null); // No user logged in
      }
    });
  }

  // Register a new user
  async register(email: string, password: string, name: string): Promise<AppUser> {
    const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
    const user = userCredential.user;

    // Default profile info
    const defaultProfile = {
      name,
      email: user.email,
      course: '',
      bio: '',
      avatar: 'https://cdn-icons-png.flaticon.com/512/1946/1946429.png',
    };

    // Default app settings
    const defaultSettings = {
      darkMode: false,
      offlineMode: false,
      notifications: { taskReminders: true },
      taskPreferences: { sortBy: 'deadline' as SortOption },
    };

    const appUser: AppUser = {
      uid: user.uid,
      ...defaultProfile,
      completedTasks: 0,
      totalTasks: 0,
      settings: defaultSettings,
    };

    // Save to Firestore
    await setDoc(doc(this.firestore, `users/${user.uid}`), {
      profile: defaultProfile,
      progress: { completedTasks: 0, totalTasks: 0 },
      settings: defaultSettings,
      createdAt: new Date(),
      isPro: false
    });

    this.userSubject.next(appUser);
    return appUser;
  }

  // Login existing user
  async login(email: string, password: string): Promise<AppUser> {
    const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
    const user = userCredential.user;
    let appUser = await this.loadUserProfile(user.uid); // Load existing profile

    // If no profile exists, create default one
    if (!appUser) {
      const defaultProfile = {
        name: user.displayName || '',
        email: user.email || '',
        course: '',
        bio: '',
        avatar: 'https://cdn-icons-png.flaticon.com/512/1946/1946429.png',
      };

      const defaultSettings = {
        darkMode: false,
        offlineMode: false,
        notifications: { taskReminders: true },
        taskPreferences: { sortBy: 'deadline' as SortOption },
      };

      await setDoc(doc(this.firestore, `users/${user.uid}`), {
        profile: defaultProfile,
        progress: { completedTasks: 0, totalTasks: 0 },
        settings: defaultSettings,
        createdAt: new Date(),
      });

      appUser = {
        uid: user.uid,
        ...defaultProfile,
        completedTasks: 0,
        totalTasks: 0,
        settings: defaultSettings,
      };
    }

    this.userSubject.next(appUser);
    return appUser;
  }

  // Logout user
  async logout() {
    await signOut(this.auth);
    this.userSubject.next(null);
  }

  // Get currently logged in Firebase user
  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  // Load user profile from Firestore
  private async loadUserProfile(uid: string): Promise<AppUser | null> {
    const docSnap = await getDoc(doc(this.firestore, `users/${uid}`));
    if (docSnap.exists()) {
      const data: any = docSnap.data();
      return {
        uid,
        email: data.profile?.email || null,
        ...data.profile,
        completedTasks: data.progress?.completedTasks || 0,
        totalTasks: data.progress?.totalTasks || 0,
        settings: data.settings,
        isPro: data.isPro || false,
      };
    }
    return null;
  }

  // Update user settings
  async updateSettings(uid: string, newSettings: Partial<AppUser['settings']>) {
    const userDoc = doc(this.firestore, `users/${uid}`);
    await updateDoc(userDoc, { settings: newSettings });
    const updated = await this.loadUserProfile(uid);
    this.userSubject.next(updated);
  }

  // Update user profile info
  async updateProfile(user: AppUser) {
    const userDoc = doc(this.firestore, `users/${user.uid}`);
    await updateDoc(userDoc, {
      profile: {
        name: user.name,
        bio: user.bio,
        course: user.course,
        avatar: user.avatar,
        email: user.email,
      },
    });
    const updated = await this.loadUserProfile(user.uid);
    this.userSubject.next(updated);
  }

  // ---------------------------
  // TASK SECTION (per-user)
  // ---------------------------

  async addTask(uid: string, task: Task): Promise<Task> {
    const tasksCol = collection(this.firestore, 'users', uid, 'tasks');
    const taskDoc = await addDoc(tasksCol, {
      subject: task.subject,
      status: task.status,
      deadline: task.deadline,
      priority: task.priority || 'normal',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.updateProgress(uid);
    return { id: taskDoc.id, ...task };
  }

  async updateTask(uid: string, task: Task) {
    if (!task.id) throw new Error('Task ID is required');
    const taskDoc = doc(this.firestore, 'users', uid, 'tasks', task.id);
    await updateDoc(taskDoc, {
      subject: task.subject,
      status: task.status,
      deadline: task.deadline,
      priority: task.priority || 'normal',
      updatedAt: new Date(),
    });

    await this.updateProgress(uid);
  }

  async deleteTask(uid: string, taskId: string) {
    const taskDoc = doc(this.firestore, 'users', uid, 'tasks', taskId);
    await deleteDoc(taskDoc);
    await this.updateProgress(uid);
  }

  async getTasks(uid: string): Promise<Task[]> {
    const tasksCol = collection(this.firestore, 'users', uid, 'tasks');
    const snapshot = await getDocs(tasksCol);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Task) }));
  }

  // Update user's task progress counts
  private async updateProgress(uid: string) {
    const tasksCol = collection(this.firestore, 'users', uid, 'tasks');
    const totalCount = (await getCountFromServer(tasksCol)).data().count;

    const completedQuery = query(tasksCol, where('status', '==', 'completed'));
    const completedCount = (await getCountFromServer(completedQuery)).data().count;

    const userDoc = doc(this.firestore, 'users', uid);
    await updateDoc(userDoc, {
      'progress.completedTasks': completedCount,
      'progress.totalTasks': totalCount,
    });

    const updated = await this.loadUserProfile(uid);
    this.userSubject.next(updated);
  }
  // Pro status upgrade
  async setUserProStatus(uid: string) {
    const userDoc = doc(this.firestore, `users/${uid}`);
    await updateDoc(userDoc, { isPro: true });

    // Refresh local user data 
    const updatedProfile = await this.loadUserProfile(uid);
    this.userSubject.next(updatedProfile);
  }
}

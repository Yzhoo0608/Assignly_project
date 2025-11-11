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
}

export interface AppUser {
  uid: string;
  email: string | null;
  name: string;
  bio?: string;
  avatar?: string;
  completedTasks?: number;
  totalTasks?: number;

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
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private userSubject = new BehaviorSubject<AppUser | null>(null);
  public user$: Observable<AppUser | null> = this.userSubject.asObservable();

  constructor() {
    this.initAuthListener();
  }

  // ---------------------------
  // AUTH SECTION
  // ---------------------------
  private initAuthListener() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        const profile = await this.loadUserProfile(user.uid);
        this.userSubject.next(profile);
      } else {
        this.userSubject.next(null);
      }
    });
  }

  async register(email: string, password: string, name: string): Promise<AppUser> {
    const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
    const user = userCredential.user;

    const defaultProfile = {
      name,
      email: user.email,
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

    const appUser: AppUser = {
      uid: user.uid,
      ...defaultProfile,
      completedTasks: 0,
      totalTasks: 0,
      settings: defaultSettings,
    };

    await setDoc(doc(this.firestore, `users/${user.uid}`), {
      profile: defaultProfile,
      progress: { completedTasks: 0, totalTasks: 0 },
      settings: defaultSettings,
      createdAt: new Date(),
    });

    this.userSubject.next(appUser);
    return appUser;
  }

  async login(email: string, password: string): Promise<AppUser> {
    const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
    const user = userCredential.user;
    let appUser = await this.loadUserProfile(user.uid);

    if (!appUser) {
      const defaultProfile = {
        name: user.displayName || '',
        email: user.email || '',
        institution: '',
        course: '',
        semester: '',
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

  async logout() {
    await signOut(this.auth);
    this.userSubject.next(null);
  }

  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

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
      };
    }
    return null;
  }

  async updateSettings(uid: string, newSettings: Partial<AppUser['settings']>) {
    const userDoc = doc(this.firestore, `users/${uid}`);
    await updateDoc(userDoc, { settings: newSettings });
    const updated = await this.loadUserProfile(uid);
    this.userSubject.next(updated);
  }

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
}

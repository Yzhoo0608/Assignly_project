// src/app/services/task.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Task } from './task';
import { Firestore, collection, collectionData, addDoc, doc, updateDoc, deleteDoc, getDocs } from '@angular/fire/firestore';
import { AuthService, AppUser } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private _tasks = new BehaviorSubject<Task[]>([]); // Holds the current list of tasks
  tasks$ = this._tasks.asObservable(); // Public observable for components to subscribe to
  private CACHE_KEY = 'cached_tasks'; // Key for localStorage caching

  constructor(private firestore: Firestore, private authService: AuthService) {
    this.loadCachedTasks(); // Load cached tasks on service init

    // Reload tasks when user logs in/out
    this.authService.user$.subscribe(user => {
      if (user) this.loadTasks(user.uid);
      else this._tasks.next([]);
    });
  }

  /** Load cached tasks from localStorage */
  private loadCachedTasks() {
    const cached = localStorage.getItem(this.CACHE_KEY);
    if (cached) {
      try {
        const parsed: any[] = JSON.parse(cached);
        this._tasks.next(parsed.map(t => this.normalizeTask(t)));
      } catch (err) {
        console.error('Error loading cached tasks:', err);
      }
    }
  }

  /** Cache tasks to localStorage */
  private cacheTasks(tasks: Task[]) {
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(tasks));
    console.log('Tasks cached/updated');
  }

  /** Normalize task object */
  private normalizeTask(task: any): Task {
    return {
      id: task.id,
      subject: task.subject || 'Untitled',
      deadline: task.deadline || new Date().toISOString().split('T')[0],
      status: task.status || 'not started',
      priority: task.priority || 'normal',
    };
  }

  /** Load tasks from Firestore */
  private async loadTasks(uid: string) {
    try {
      const tasksCol = collection(this.firestore, 'users', uid, 'tasks');
      const snapshot = await getDocs(tasksCol);
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Task) }));
      const normalized = tasks.map(t => this.normalizeTask(t));
      this._tasks.next(normalized);
      this.cacheTasks(normalized);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  }

  /** Get current logged-in user */
  private async getCurrentUser(): Promise<AppUser> {
    const user = await firstValueFrom(this.authService.user$);
    if (!user) throw new Error('User not logged in');
    return user;
  }

  /** Add a new task */
  async addTask(task: Task): Promise<Task> {
    const user = await this.getCurrentUser();
    const tasksCol = collection(this.firestore, 'users', user.uid, 'tasks');
    const docRef = await addDoc(tasksCol, {
      subject: task.subject,
      status: task.status,
      deadline: task.deadline,
      priority: task.priority || 'normal',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const newTask: Task = { ...task, id: docRef.id };
    return newTask;
  }

  /** Update an existing task */
  async updateTask(task: Task) {
    if (!task.id) throw new Error('Task ID required');
    const user = await this.getCurrentUser();
    const taskDoc = doc(this.firestore, 'users', user.uid, 'tasks', task.id);

    // Update Firestore
    await updateDoc(taskDoc, {
      subject: task.subject,
      status: task.status,
      deadline: task.deadline,
      priority: task.priority || 'normal',
      updatedAt: new Date(),
    });

    // Update local cache
    const updatedTasks = this._tasks.value.map(t =>
      t.id === task.id ? { ...t, status: task.status, subject: task.subject, deadline: task.deadline } : t
    );
    this._tasks.next(updatedTasks);
    this.cacheTasks(updatedTasks);
  }


  /** Delete a task */
  async deleteTask(task: Task) {
    // Remove from BehaviorSubject immediately
    const updated = this._tasks.value.filter(t => t.id !== task.id);
    this._tasks.next(updated);
    this.cacheTasks(updated);

    // Delete from Firestore in background
    try {
      if (!task.id) throw new Error('Task ID required');
      const user = await firstValueFrom(this.authService.user$);
      if (!user) throw new Error('User not logged in');
      const taskDoc = doc(this.firestore, 'users', user.uid, 'tasks', task.id);
      await deleteDoc(taskDoc);
    } catch (err) {
      console.warn('Offline delete (will sync later):', err);
    }
  }

  /** Public method to get all tasks for current user (async) */
  async getTasks(): Promise<Task[]> {
    const user = await this.getCurrentUser(); // uses existing private method
    const tasksCol = collection(this.firestore, 'users', user.uid, 'tasks');
    const snapshot = await getDocs(tasksCol);
    return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as Task) }));
  }

  /** Add task locally with a temporary ID */
  addTaskLocally(task: Task) {
    // Assign a temporary ID to distinguish from Firestore ID
    const tempTask = { ...task, id: 'temp-' + Date.now() };
    const current = this._tasks.value;
    this._tasks.next([...current, tempTask]);
    return tempTask; // return for reference if needed
  }
}

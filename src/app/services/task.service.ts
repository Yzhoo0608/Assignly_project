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
  private _tasks = new BehaviorSubject<Task[]>([]);
  tasks$ = this._tasks.asObservable();
  private CACHE_KEY = 'cached_tasks';

  constructor(private firestore: Firestore, private authService: AuthService) {
    this.loadCachedTasks();

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
  }

  /** Normalize task object */
  private normalizeTask(task: any): Task {
    return {
      id: task.id,
      subject: task.subject || 'Untitled',
      deadline: task.deadline || new Date().toISOString().split('T')[0],
      status: task.status || 'not started',
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
  async addTask(task: Task) {
    const user = await this.getCurrentUser();
    const tasksCol = collection(this.firestore, 'users', user.uid, 'tasks');
    const docRef = await addDoc(tasksCol, {
      subject: task.subject,
      status: task.status,
      deadline: task.deadline,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const newTask: Task = { id: docRef.id, ...task };
    const updatedTasks = [...this._tasks.value, newTask];
    this._tasks.next(updatedTasks);
    this.cacheTasks(updatedTasks);
  }

  /** Update existing task */
  async updateTask(task: Task) {
    if (!task.id) throw new Error('Task ID required');
    const user = await this.getCurrentUser();
    const taskDoc = doc(this.firestore, 'users', user.uid, 'tasks', task.id);
    await updateDoc(taskDoc, { ...task, updatedAt: new Date() });

    const updatedTasks = this._tasks.value.map(t => (t.id === task.id ? task : t));
    this._tasks.next(updatedTasks);
    this.cacheTasks(updatedTasks);
  }

  /** Delete a task */
  async deleteTask(task: Task) {
    if (!task.id) throw new Error('Task ID required');
    const user = await this.getCurrentUser();
    const taskDoc = doc(this.firestore, 'users', user.uid, 'tasks', task.id);
    await deleteDoc(taskDoc);

    const remainingTasks = this._tasks.value.filter(t => t.id !== task.id);
    this._tasks.next(remainingTasks);
    this.cacheTasks(remainingTasks);
  }
}

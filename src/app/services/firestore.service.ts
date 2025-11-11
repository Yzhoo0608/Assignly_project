// src/app/services/firestore.service.ts
import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, doc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { authState } from 'rxfire/auth';
import { Observable, of, switchMap } from 'rxjs';
import { Task } from './task';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  constructor(private firestore: Firestore, private auth: Auth) {}

  getTasks(): Observable<Task[]> {
    return authState(this.auth).pipe(
      switchMap(user => {
        if (!user) return of([]);
        const tasksRef = collection(this.firestore, `users/${user.uid}/tasks`);
        return collectionData(tasksRef, { idField: 'id' }) as Observable<Task[]>;
      })
    );
  }

  async addTask(task: Task) {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not logged in');
    const tasksRef = collection(this.firestore, `users/${user.uid}/tasks`);
    return await addDoc(tasksRef, { ...task, createdAt: new Date(), updatedAt: new Date() });
  }

  async updateTask(id: string, task: Partial<Task>) {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not logged in');
    const taskDoc = doc(this.firestore, `users/${user.uid}/tasks/${id}`);
    await updateDoc(taskDoc, { ...task, updatedAt: new Date() });
  }

  async deleteTask(id: string) {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not logged in');
    const taskDoc = doc(this.firestore, `users/${user.uid}/tasks/${id}`);
    await deleteDoc(taskDoc);
  }
}

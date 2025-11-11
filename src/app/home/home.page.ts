// src/app/home/home.page.ts
import { Component, OnInit } from '@angular/core';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FirestoreService } from '../services/firestore.service';
import { Task } from '../services/task';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class HomePage implements OnInit {
  tasks: Task[] = [];
  searchTerm = '';
  isAdding = false;
  newTaskSubject = '';
  newTaskDeadline = '';
  newTaskStatus: Task['status'] = 'not started';

  constructor(
    private router: Router,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private firestoreService: FirestoreService
  ) {}

  ngOnInit() {
    this.loadTasks();
  }

  loadTasks() {
    this.firestoreService.getTasks().subscribe(tasks => {
      this.tasks = tasks;
    });
  }

  toggleAdd() {
    this.isAdding = !this.isAdding;
    this.newTaskSubject = '';
    this.newTaskDeadline = '';
    this.newTaskStatus = 'not started';
  }

  async addTask() {
    if (!this.newTaskSubject || !this.newTaskDeadline) return;

    const task: Task = {
      subject: this.newTaskSubject,
      deadline: this.newTaskDeadline,
      status: this.newTaskStatus,
    };

    await this.firestoreService.addTask(task);
    this.toggleAdd();

    const toast = await this.toastCtrl.create({
      message: 'Task added successfully!',
      duration: 1200,
      color: 'success',
    });
    toast.present();
  }

  async toggleTaskStatus(task: Task) {
    const newStatus = task.status === 'completed' ? 'not started' : 'completed';
    await this.firestoreService.updateTask(task.id!, { status: newStatus });
  }

  async deleteTask(task: Task) {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete "${task.subject}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: async () => {
            await this.firestoreService.deleteTask(task.id!);
            const toast = await this.toastCtrl.create({
              message: 'Task deleted successfully!',
              duration: 1200,
              color: 'danger',
            });
            toast.present();
          },
        },
      ],
    });
    await alert.present();
  }

  applyFilter() {
    this.tasks = this.tasks.filter(task =>
      task.subject.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }
}

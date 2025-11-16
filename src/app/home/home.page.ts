// src/app/home/home.page.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Task } from '../services/auth.service'; 
import { TaskService } from '../services/task.service';
import { AdService } from '../services/ad'; 
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class HomePage implements OnInit, OnDestroy {
  tasks: Task[] = []; // Holds the list of tasks
  searchTerm = ''; // For search input binding
  isAdding = false; // Toggle add task form
  newTaskSubject = ''; // New task subject
  newTaskDeadline = ''; // New task deadline
  newTaskStatus: Task['status'] = 'not started'; // Default status

  // Pro feature: Task Priority
  newTaskPriority: Task['priority'] = 'normal'; // Default priority
  public isPro: boolean = false; // Pro status flag
  private proStatusSub?: Subscription; // Subscription for pro status

  constructor(
    private router: Router,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private taskService: TaskService,
    private adService: AdService
  ) { }

  ngOnInit() {
    // Subscribe to the tasks BehaviorSubject
    this.taskService.tasks$.subscribe(tasks => {
      this.tasks = tasks;
    });

    // Subscribe to Pro status updates
    this.proStatusSub = this.adService.proStatus$.subscribe(status => {
      this.isPro = status;
      console.log('Home Page: Pro status is now', this.isPro);
    });
  } 

  ngOnDestroy() {
    // Cleanup subscription to avoid memory leaks
    if (this.proStatusSub) {
      this.proStatusSub.unsubscribe();
    }
  }

  // Show an interstitial ad if not a Pro user
  showAd() {
    this.adService.showInterstitial();
  }

  // Upgrade to Pro and show confirmation alert
  async goPro() {
    await this.adService.purchasePro();
    // Show a nice alert to the user
    const alert = await this.alertCtrl.create({
      header: 'Upgrade Complete!',
      message: 'You are now a Pro user and have unlocked Task Priorities!',
      buttons: ['OK']
    });
    await alert.present();
  }

  // Helper to get CSS class based on task priority
  getPriorityClass(task: Task): string {
    const priority = task.priority || 'normal';
    return `priority-${priority}`; // return 'priority-high', 'priority-normal', etc
  }

  // Toggle the add-task form visibility
  toggleAdd() {
    this.isAdding = !this.isAdding;
    this.newTaskSubject = '';
    this.newTaskDeadline = '';
    this.newTaskStatus = 'not started';
    this.newTaskPriority = 'normal';
  }

  // Add a new task
  async addTask() {
    if (!this.newTaskSubject || !this.newTaskDeadline) return;

    const task: Task = {
      subject: this.newTaskSubject,
      deadline: this.newTaskDeadline,
      status: this.newTaskStatus,
      priority: this.newTaskPriority,
    };

    // Add to UI immediately with temp ID
    const tempTask = this.taskService.addTaskLocally(task);

    // Close the form immediately
    this.toggleAdd();

    
    try {
      const addedTask = await this.taskService.addTask(task);

      // Replace temp task with real task
      const current = this.taskService['_tasks'].value;
      this.taskService['_tasks'].next(
        current.map(t => (t.id === tempTask.id ? addedTask : t))
      );

    } catch (err) {
      console.error('Failed to add task:', err);
    }

    // Show success toast
    const toast = await this.toastCtrl.create({
      message: 'Task added successfully!',
      duration: 1200,
      color: 'success',
    });
    toast.present();
  }

  async toggleTaskStatus(task: Task) {
    // Normalize to lowercase to prevent mismatch
    const status = task.status?.toLowerCase().trim() ?? 'not started';

    if (status === 'not started') task.status = 'in progress';
    else if (status === 'in progress') task.status = 'completed';
    else task.status = 'not started';

    // Pass task ID and task object
    await this.taskService.updateTask(task);
  }

  // Confirm and delete a task
  async deleteTask(task: Task) {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete "${task.subject}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: () => {
            // Remove task from UI immediately
            this.taskService.deleteTask(task);

            // Show deletion toast
            this.toastCtrl.create({
              message: 'Task deleted successfully!',
              duration: 1200,
              color: 'danger',
            }).then(toast => toast.present());
          },
        },
      ],
    });
    await alert.present();
  }

  // Filter tasks based on search input
  applyFilter() {
    this.tasks = this.tasks.filter(task =>
      task.subject.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }
}
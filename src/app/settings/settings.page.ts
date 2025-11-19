// src/app/settings/settings.page.ts

import { Component, OnInit } from '@angular/core';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { TaskService } from '../services/task.service';
import { NotificationService } from '../services/notification.service';
import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { AdService } from '../services/ad';

@Component({
  selector: 'app-settings',
  standalone: true,
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class SettingsPage implements OnInit {

  userName = '';

  taskReminders = true;
  autoSort = false;

  // Task visibility as multi-select array
  selectedTaskVisibility: string[] = ['notStarted', 'inProgress', 'completed', 'pastDue'];

  notificationTime: '1h' | '3h' | '1d' | '3d' | '1w' | undefined = '1h';

  reminderOptions = [
    { label: '1 hour before', value: '1h' },
    { label: '3 hours before', value: '3h' },
    { label: '1 day before', value: '1d' },
    { label: '3 days before', value: '3d' },
    { label: '1 week before', value: '1w' },
  ];

  constructor(
    private authService: AuthService,
    private taskService: TaskService,
    private notificationService: NotificationService,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private adService: AdService
  ) {}

  ngOnInit() {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.userName = user.name;

        // Load settings
        this.autoSort = user.settings?.autoSort ?? false;
        this.taskReminders = user.settings?.taskReminders ?? true;

        // Only set default 1d if reminders are on and no previous setting exists
        this.notificationTime = this.taskReminders
          ? (user.settings?.notificationTime ?? '1d')
          : undefined;

        // Load task visibility or default to all
        this.selectedTaskVisibility = user.settings?.taskVisibility?.length
          ? user.settings.taskVisibility
          : ['notStarted', 'inProgress', 'completed', 'pastDue'];
      }
    });
  }


  // ---------------------------------------------------
  // Task Visibility Update
  // ---------------------------------------------------
  async updateTaskVisibility() {
    if (!this.selectedTaskVisibility || this.selectedTaskVisibility.length === 0) {
      this.selectedTaskVisibility = ['notStarted', 'inProgress', 'completed', 'pastDue'];
    }

    console.log("Task visibility updated:", this.selectedTaskVisibility);

    const user = await firstValueFrom(this.authService.user$);
    if (!user) return;

    const currentSettings = user.settings ?? {}; // get current settings safely
    await this.authService.updateSettings(user.uid, {
      ...currentSettings,
      taskVisibility: this.selectedTaskVisibility
    });
  }

  // ---------------------------------------------------
  // Task Reminder Toggle
  // ---------------------------------------------------
  async updateTaskReminders() {
    const user = await firstValueFrom(this.authService.user$);
    if (!user) return;

    if (!this.taskReminders) {
      this.notificationTime = undefined;
    }

    await this.authService.updateSettings(user.uid, {
      taskReminders: this.taskReminders,
      notificationTime: this.notificationTime
    });

    if (this.taskReminders && this.notificationTime) {
      this.scheduleNotificationForTask();
    }
  }

  // ---------------------------------------------------
  // Reminder Time Change
  // ---------------------------------------------------
  async updateNotificationTime() {
    const user = await firstValueFrom(this.authService.user$);
    if (!user || !this.notificationTime) return;

    await this.authService.updateSettings(user.uid, {
      taskReminders: this.taskReminders,
      notificationTime: this.notificationTime
    });

    if (this.taskReminders) {
      this.scheduleNotificationForTask();
    }
  }

  private getSecondsFromTime(value: string): number {
    switch (value) {
      case '1h': return 3600;
      case '3h': return 3 * 3600;
      case '1d': return 24 * 3600;
      case '3d': return 3 * 24 * 3600;
      case '1w': return 7 * 24 * 3600;
      default: return 24 * 3600;
    }
  }

  private scheduleNotificationForTask() {
    if (!this.notificationTime) return;

    const seconds = this.getSecondsFromTime(this.notificationTime);

    // Convert seconds to hours for logging
    const hours = seconds / 3600;

    if (Capacitor.getPlatform() === 'web') {
      console.log(`Task Reminder scheduled in ${hours} hours`);
    } else {
      this.notificationService.scheduleNotification(
        'Task Reminder',
        'Don\'t forget to complete your task!',
        seconds,
        'task-123'
      );
    }
  }

  // ---------------------------------------------------
  // Auto Sort
  // ---------------------------------------------------
  async updateAutoSort() {
    const uid = this.authService.getCurrentUser()!.uid;
    await this.authService.updateSettings(uid, { autoSort: this.autoSort });
  }

  // ---------------------------------------------------
  // GoPro 
  // ---------------------------------------------------
  async goPro() {
    await this.adService.purchasePro();
    const alert = await this.alertCtrl.create({
      header: 'Upgrade Complete',
      message: 'You are now a Pro user and have unlocked Task Priorities',
      buttons: ['OK']
    });
    await alert.present();
  }

  // ---------------------------------------------------
  // Clear Completed Tasks
  // ---------------------------------------------------
  async confirmClearCompleted() {
    const alert = await this.alertCtrl.create({
      header: 'Clear Completed Tasks',
      message: 'Are you sure you want to clear all completed tasks?',
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: 'Yes',
          handler: async () => {
            const uid = this.authService.getCurrentUser()!.uid;
            await this.taskService.deleteCompletedTasks(uid);

            const toast = await this.toastCtrl.create({
              message: 'Completed tasks cleared',
              duration: 1500,
              color: 'success'
            });
            toast.present();
          }
        }
      ]
    });

    await alert.present();
  }

  openProfile() {
    this.router.navigate(['/profile']);
  }

  // Delete User Account
  async confirmDeleteAccount() {
    const alert = await this.alertCtrl.create({
      header: 'Delete Account?',
      message: 'This will permanently remove all your data.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: () => this.deleteAccount()
        }
      ]
    });

    await alert.present();
  }

  async deleteAccount() {
    await this.authService.deleteAccount();
    this.router.navigate(['/login']);
  }

  // Logout
  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { 
          text: 'Logout',
          handler: async () => {
            await this.authService.logout();
            this.router.navigateByUrl('/login', { replaceUrl: true });
          }
        }
      ]
    });

    await alert.present();
  }
}

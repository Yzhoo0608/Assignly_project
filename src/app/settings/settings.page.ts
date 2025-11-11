// src/app/settings/settings.page.ts
import { Component, OnInit } from '@angular/core';
import { IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class SettingsPage implements OnInit {
  userName = '';
  darkMode = false;
  offlineMode = false;
  notifications = { taskReminders: true, dailySummary: true };
  taskPreferences: { sortBy: 'deadline' | 'subject' | 'completion' } = { sortBy: 'deadline' };

  constructor(private authService: AuthService, private router: Router, private toastCtrl: ToastController) {}

  ngOnInit() {
  this.authService.user$.subscribe(user => {
    if (user) {
      this.userName = user.name;
      this.darkMode = user.settings?.darkMode || false;
      this.offlineMode = user.settings?.offlineMode || false;
      this.notifications = { ...this.notifications, ...user.settings?.notifications };
      this.taskPreferences = {
        sortBy: user.settings?.taskPreferences?.sortBy as 'deadline' | 'subject' | 'completion' || 'deadline'
      };
    }
  });
}


  async toggleDarkMode() {
    this.darkMode = !this.darkMode;
    document.body.classList.toggle('dark', this.darkMode);
    await this.authService.updateSettings(this.authService.getCurrentUser()!.uid, { darkMode: this.darkMode });
  }

  async toggleOfflineMode() {
    this.offlineMode = !this.offlineMode;
    await this.authService.updateSettings(this.authService.getCurrentUser()!.uid, { offlineMode: this.offlineMode });
  }

    
  async updateNotifications() {
    await this.authService.updateSettings(this.authService.getCurrentUser()!.uid, { notifications: this.notifications });
  }

  async updateTaskPreferences() {
    await this.authService.updateSettings(this.authService.getCurrentUser()!.uid, { taskPreferences: this.taskPreferences });
  }

    openProfile() {
    this.router.navigate(['/profile']);
  }

  async logout() {
    await this.authService.logout();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}


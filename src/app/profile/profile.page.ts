// src/app/profile/profile.page.ts
import { Component, OnInit } from '@angular/core';
import { IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, AppUser } from '../services/auth.service';
import { TaskService } from '../services/task.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class ProfilePage implements OnInit {
user: AppUser = {
  uid: '',
  name: '',
  email: '',
  avatar: '',
  bio: '',
  completedTasks: 0,
  totalTasks: 0,
  institution: '',
  course: '',
  semester: '',
  settings: {}
};


  constructor(
    private authService: AuthService,
    private taskService: TaskService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    // Subscribe to user changes
    this.authService.user$.subscribe(user => {
      if (user) {
        this.user = { ...this.user, ...user };
        this.loadProgress(); // Load task progress after user is available
      }
    });
  }

  // Load total and completed tasks for progress overview
  async loadProgress() {
    try {
      const tasks = await this.taskService.getTasks(); // Use the new async getTasks()
      this.user.totalTasks = tasks.length;
      this.user.completedTasks = tasks.filter(t => t.status === 'completed').length;
    } catch (err) {
      console.error('Error loading tasks for progress:', err);
    }
  }

  changeAvatar(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => (this.user.avatar = reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  async saveProfile() {
    await this.authService.updateProfile(this.user);
    const toast = await this.toastCtrl.create({ message: 'Profile saved!', duration: 1500 });
    toast.present();
  }

  async logout() {
    await this.authService.logout();
    window.location.href = '/login';
  }
}

// src/app/profile/profile.page.ts
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { IonicModule, ToastController, ActionSheetController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, AppUser } from '../services/auth.service';
import { TaskService } from '../services/task.service';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { UxService } from '../services/ux.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class ProfilePage implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  canDeviceShare = false;

  user: AppUser = {
    uid: '',
    name: '',
    email: '',
    avatar: '',
    bio: '',
    completedTasks: 0,
    totalTasks: 0,
    course: '',
    settings: {}
  };

  constructor(
    private authService: AuthService,
    private taskService: TaskService,
    private toastCtrl: ToastController,
    private uxService: UxService,
    private actionSheetCtrl: ActionSheetController
  ) {}

  ngOnInit() {
    // Subscribe to user changes
    this.authService.user$.subscribe(user => {
      if (user) {
        this.user = { ...this.user, ...user };
        this.loadProgress();
      }
    });

    // Check share capability
    this.checkShareCapability();
  }

  async checkShareCapability() {
    // Check if device/browser can share
    if (Capacitor.getPlatform() === 'web') {
      this.canDeviceShare = !!navigator.share;
    } else {
      const canShareResult = await this.uxService.canShare();
      this.canDeviceShare = canShareResult.value;
    }
  }

  async loadProgress() {
    try {
      const tasks = await this.taskService.getTasks();
      this.user.totalTasks = tasks.length;
      this.user.completedTasks = tasks.filter(t => t.status === 'completed').length;
    } catch (err) {
      console.error('Error loading tasks:', err);
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

  async openAvatarOptions() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Change Avatar',
      buttons: [
        { text: 'Take Photo', icon: 'camera', handler: () => this.takePhoto() },
        { text: 'Choose from Gallery', icon: 'images', handler: () => this.fileInput.nativeElement.click() },
        { text: 'Cancel', icon: 'close', role: 'cancel' }
      ]
    });
    await actionSheet.present();
  }

  async takePhoto() {
    if (Capacitor.getPlatform() === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        const canvas = document.createElement('canvas');
        await new Promise(resolve => setTimeout(resolve, 500));
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (context) context.drawImage(video, 0, 0, canvas.width, canvas.height);
        this.user.avatar = canvas.toDataURL('image/jpeg');
        stream.getTracks().forEach(track => track.stop());
      } catch {
        this.fileInput.nativeElement.click();
      }
    } else {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });
      this.user.avatar = image.dataUrl!;
    }
  }

  async saveProfile() {
    await this.authService.updateProfile(this.user);
    const toast = await this.toastCtrl.create({ message: 'Profile Saved', duration: 1500 });
    toast.present();
  }

  // Share profile
  async shareProfile() {
    const profileText = `Check out my profile: ${this.user.name}`;
    const profileUrl = 'http://localhost:8100/profile';

    if (Capacitor.getPlatform() === 'web') {
      // Web Share API
      if (navigator.share) {
        try {
          await navigator.share({ title: 'My Profile', text: profileText, url: profileUrl });
        } catch (err) {
          console.error('Share failed:', err);
        }
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(`${profileText} ${profileUrl}`).then(() => {
          alert('Profile info copied to clipboard!');
        });
      }
    } else {
      // Native share via Capacitor
      await this.uxService.shareProfile(this.user.name, this.user.avatar);
    }
  }
}




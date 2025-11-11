import { Component } from '@angular/core';
import { IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, AppUser } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule, RouterModule],
})
export class LoginPage {
  email = '';
  name = '';
  password = '';
  isRegistering = false;
  errorMessage = '';
  loading = false;

  constructor(
    private router: Router,
    private toastCtrl: ToastController,
    private authService: AuthService
  ) {}

  // Handle login or registration
  async submit() {
    // Basic validation
    if (!this.email || !this.password || (this.isRegistering && !this.name)) {
      const toast = await this.toastCtrl.create({
        message: 'Please fill in all required fields!',
        duration: 1500,
        color: 'warning',
      });
      await toast.present();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      let user: AppUser;

      if (this.isRegistering) {
        // Register new user
        user = await this.authService.register(this.email, this.password, this.name);
      } else {
        // Login existing user
        user = await this.authService.login(this.email, this.password);
      }

      // Show success toast
      const toast = await this.toastCtrl.create({
        message: `${this.isRegistering ? 'Registration' : 'Login'} successful!`,
        duration: 1200,
        color: 'success',
      });
      await toast.present();

      // Navigate to home after short delay
      setTimeout(() => {
        this.router.navigate(['/home'], { replaceUrl: true });
      }, 100);

    } catch (err: any) {
      console.error(err);
      this.errorMessage = err.message || 'Something went wrong';
      const toast = await this.toastCtrl.create({
        message: this.errorMessage,
        duration: 2000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.loading = false;
    }
  }

  // Toggle between login and register mode
  toggleMode() {
    this.isRegistering = !this.isRegistering;
    this.errorMessage = '';
    this.name = '';
    this.email = '';
    this.password = '';
  }
}

// src/app/app.component.ts
// src/app/app.component.ts
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AlertController, ToastController, IonicModule } from '@ionic/angular';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [IonicModule, RouterModule],
})
export class AppComponent {
  constructor(
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private authService: AuthService,
  ) {}
// src/app/app.component.ts
async logout() {
  const alert = await this.alertCtrl.create({
    header: 'Confirm Logout',
    message: 'Do you really want to log out?',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Logout',
        handler: async () => {
          await this.authService.logout();
          const toast = await this.toastCtrl.create({
            message: 'Logged out successfully!',
            duration: 1200,
            color: 'medium',
          });
          toast.present();
          this.router.navigateByUrl('/login', { replaceUrl: true });
        },
      },
    ],
  });
  await alert.present();
}
}

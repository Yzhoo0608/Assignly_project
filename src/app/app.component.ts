import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { AlertController, ToastController, MenuController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common'; // ✅ Add this
import { AuthService } from './services/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [IonicModule, RouterModule, CommonModule], // ✅ Add CommonModule here
})
export class AppComponent implements OnInit {
  showMenu = false;

  constructor(
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private authService: AuthService,
    private menu: MenuController
  ) {}

  ngOnInit() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const menuPages = ['/home', '/profile', '/settings'];
        this.showMenu = menuPages.includes(event.url);
        this.menu.enable(this.showMenu);
        this.menu.swipeGesture(this.showMenu);
      });
  }

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

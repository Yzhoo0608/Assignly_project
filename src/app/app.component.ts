import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { AlertController, ToastController, MenuController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common'; 
import { AuthService } from './services/auth.service';
import { filter } from 'rxjs/operators';
import { AdService } from './services/ad';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [IonicModule, RouterModule, CommonModule], 
})
export class AppComponent implements OnInit {
  showMenu = false; // Control side menu visibility

  constructor(
    private router: Router, // Router for navigation events
    private alertCtrl: AlertController, // Alert controller for logout confirmation
    private toastCtrl: ToastController, // Toast controller for feedback messages
    private authService: AuthService, // Auth service for logout
    private menu: MenuController, // Menu controller to enable/disable menu
    private adService: AdService // Ad service to manage ads
  ) {}
  

  ngOnInit() {
    // Show/hide menu based on current route
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const menuPages = ['/home', '/profile', '/settings'];
        this.showMenu = menuPages.includes(event.url);
        this.menu.enable(this.showMenu);
        this.menu.swipeGesture(this.showMenu);
      });
  }

  // Logout with confirmation
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
              message: 'Logged Out Successfully',
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

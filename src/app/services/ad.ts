// src/app/services/ad.ts
import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { AuthService } from './auth.service'; // <-- Import AuthService
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AdService {

  // Observable to track whether user is Pro
  public proStatus$: Observable<boolean>;

  constructor(
    private platform: Platform,
    private authService: AuthService // <-- Inject AuthService
  ) {
    // Log the simulation message on init
    this.init();
    
    // Map the user$ observable to a simple boolean
    this.proStatus$ = this.authService.user$.pipe(
      map(user => user?.isPro || false) // true if user is pro, false otherwise
    );
  }

  init() {
    // Initialize Ad simulation
    if (this.platform.is('capacitor')) {
      console.log('[AdService] Initializing AdMob...');
    } else {
      console.log('[AdService] AdMob cannot be initialized on a desktop browser. Simulating.');
    }
  }

 // Show interstitial ad (simulated for non-Pro users)
  showInterstitial() {
    const user = this.authService['userSubject'].getValue(); 
    const isPro = user?.isPro || false;
    
    if (isPro) {
      return; // Don't show for pro users
    }
    
    console.log('[AdService] SIMULATING: Showing Interstitial Ad...'); // No ads for Pro users
  }

  // Upgrade user to Pro
  async purchasePro() {
    
    const uid = this.authService.getCurrentUser()?.uid;
    if (!uid) {
      console.error("User not logged in. Can't purchase Pro.");
      return;
    }

    try {
      // Update Firestore & App state
      await this.authService.setUserProStatus(uid);

      console.log('[AdService] User has purchased Pro! (Saved to cloud)');

    } catch (e) {
      console.error("Error purchasing Pro: ", e);
    }
  }
}
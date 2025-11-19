// src/app/services/ad.ts
import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { AuthService } from './auth.service'; 
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
    private authService: AuthService 
  ) {
    // Log the simulation message on init
    this.init();
    
    
    this.proStatus$ = this.authService.user$.pipe(
      map(user => user?.isPro || false) 
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

 // Show interstitial ad 
  showInterstitial() {
    const user = this.authService['userSubject'].getValue(); 
    const isPro = user?.isPro || false;
    
    if (isPro) {
      return; 
    }
    
    console.log('[AdService] SIMULATING: Showing Interstitial Ad...'); 
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
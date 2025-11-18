// src/app/services/ux.service.ts
import { Injectable } from '@angular/core';
import { Share } from '@capacitor/share';

@Injectable({ providedIn: 'root' })
export class UxService {
  canShare(): Promise<{ value: boolean }> {
    return Share.canShare();
  }

  shareProfile(name: string, avatar?: string) {
    return Share.share({
      title: 'My Profile',
      text: `Check out my profile: ${name}`,
      url: avatar, // optional
      dialogTitle: 'Share your profile'
    });
  }
}



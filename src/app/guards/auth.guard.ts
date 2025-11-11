// src/app/guards/auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Storage } from '@ionic/storage-angular';
import { getAuth } from 'firebase/auth';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private storage: Storage, private router: Router) {}

  async canActivate(): Promise<boolean> {
    await this.storage.create();
    const loggedIn = await this.storage.get('loggedIn');
    const firebaseUser = getAuth().currentUser;

    if (loggedIn || firebaseUser) return true;

    this.router.navigateByUrl('/login', { replaceUrl: true });
    return false;
  }
}

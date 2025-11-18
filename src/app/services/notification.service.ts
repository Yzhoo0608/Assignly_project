import { Injectable } from '@angular/core';
import {
  LocalNotifications,
  ScheduleOptions,
  ActionPerformed
} from '@capacitor/local-notifications';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationAction = new BehaviorSubject<ActionPerformed | null>(null);
  public notificationAction$ = this.notificationAction.asObservable();

  constructor() {
    this.setupNotificationTapListener();
  }

  async requestPermissions(): Promise<boolean> {
    const perm = await LocalNotifications.requestPermissions();
    return perm.display === 'granted';
  }

  async scheduleNotification(title: string, body: string, secondsFromNow: number, taskId?: string) {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.error('Notification permission not granted');
      return;
    }

    const options: ScheduleOptions = {
      notifications: [
        {
          id: new Date().getTime(),
          title,
          body,
          schedule: { at: new Date(Date.now() + 1000 * secondsFromNow) },
          extra: { taskId: taskId || 'task-unknown' }
        }
      ]
    };

    try {
      await LocalNotifications.schedule(options);
    } catch (err) {
      console.error('Error scheduling notification', err);
    }
  }

  private setupNotificationTapListener() {
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      this.notificationAction.next(action);
    });
  }
}

// src/app/home/home.page.ts
import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Task, AuthService } from '../services/auth.service';
import { TaskService } from '../services/task.service';
import { AdService } from '../services/ad';
import { Subscription, Observable, firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule],
})
export class HomePage implements OnInit, OnDestroy {
  tasks$!: Observable<Task[]>;
  private tasksSub?: Subscription;
  private userSub?: Subscription;
  allTasks: Task[] = [];
  filteredTasks: Task[] = [];

  taskForm!: FormGroup;
  isAdding = false;
  editingTask: Task | null = null;
  @ViewChild('formContainer') formContainer!: ElementRef;

  searchTerm = '';
  minDate: string;
  subjectError = '';
  deadlineError = '';
  duplicateError = '';

  isPro = false;
  private proStatusSub?: Subscription;

  taskSection: 'all' | 'completed' | 'pastDue' = 'all';
  autoSort = false;
  taskVisibility = { showNotStarted: true, showInProgress: true, showCompleted: true, showPastDue: true };
  selectedTaskVisibility: string[] = ['notStarted', 'inProgress', 'completed', 'pastDue'];


  constructor(
    private taskService: TaskService,
    private fb: FormBuilder,
    private router: Router,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private adService: AdService,
    private authService: AuthService
  ) {
    this.minDate = new Date().toISOString().slice(0, 16);
  }

  ngOnInit() {
    this.taskForm = this.fb.group({
      subject: ['', Validators.required],
      deadline: ['', Validators.required],
      status: ['not started', Validators.required],
      priority: ['normal'],
    });

    this.tasks$ = this.taskService.tasks$;
    this.tasksSub = this.tasks$.subscribe(tasks => {
      this.allTasks = tasks || [];
      this.updatePastDueTasks(); // mark past due
      this.applyFilter();
    });

    this.userSub = this.authService.user$.subscribe(user => {
      if (user?.settings) {
        this.autoSort = user.settings.autoSort ?? false;

        // Map the array from settings to the object used in HomePage
        const visibilityArray: string[] = user.settings.taskVisibility ?? ['notStarted','inProgress','completed','pastDue'];
        this.taskVisibility = {
          showNotStarted: visibilityArray.includes('notStarted'),
          showInProgress: visibilityArray.includes('inProgress'),
          showCompleted: visibilityArray.includes('completed'),
          showPastDue: visibilityArray.includes('pastDue'),
        };

        // Update local selectedTaskVisibility so it stays in sync
        this.selectedTaskVisibility = visibilityArray;
      }
      this.applyFilter();
    });

    this.proStatusSub = this.adService.proStatus$.subscribe(status => this.isPro = !!status);
  }

  ngOnDestroy() {
    this.tasksSub?.unsubscribe();
    this.userSub?.unsubscribe();
    this.proStatusSub?.unsubscribe();
  }

  /** --- MARK TASKS AS PAST DUE --- */
  async updatePastDueTasks() {
    const now = Date.now();
    let hasChanges = false;

    for (const task of this.allTasks) {
      const deadlineTime = new Date(task.deadline).getTime();
      if (deadlineTime < now && task.status !== 'completed' && task.status !== 'pastDue') {
        task.status = 'pastDue';
        hasChanges = true;
        if (task.id) await this.taskService.updateTask(task); // update Firestore
      }
    }

    if (hasChanges) {
      // Force Angular to detect changes
      this.allTasks = [...this.allTasks];
      this.applyFilter();
    }
  }

  /** --- FILTER & SORT TASKS --- */
  applyFilter() {
    let filtered = [...this.allTasks];

    // Section filter
    filtered = filtered.filter(task => {
      if (this.taskSection === 'completed') return task.status === 'completed';
      if (this.taskSection === 'pastDue') return task.status === 'pastDue';
      // show based on visibility
      if (task.status === 'not started') return this.taskVisibility.showNotStarted;
      if (task.status === 'in progress') return this.taskVisibility.showInProgress;
      if (task.status === 'completed') return this.taskVisibility.showCompleted;
      if (task.status === 'pastDue') return this.taskVisibility.showPastDue;
      return true;
    });

    // Search filter
    const term = this.searchTerm?.trim().toLowerCase();
    if (term) {
      filtered = filtered.filter(t => (t.subject || '').toLowerCase().includes(term));
    }

    // Auto sort
    if (this.autoSort) {
      filtered.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    }

    this.filteredTasks = filtered;
  }

  filterBySection() {
    this.applyFilter();
  }

  // --- Add/Edit Task ---
  toggleAdd() {
    this.isAdding = !this.isAdding;
    this.editingTask = null;
    this.taskForm.reset({ status: 'not started', priority: 'normal' });
    this.subjectError = '';
    this.deadlineError = '';
    this.duplicateError = '';

    if (this.isAdding) {
      setTimeout(() => {
        try { this.formContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
      }, 200);
    }
  }

  async addTask() {
    this.subjectError = '';
    this.deadlineError = '';
    this.duplicateError = '';

    this.taskForm.markAllAsTouched();
    const formValue = this.taskForm.value;

    if (!formValue.subject?.trim()) {
      this.subjectError = '* Required';
      return;
    }
    if (!formValue.deadline) {
      this.deadlineError = '* Required';
      return;
    }

    const selected = new Date(formValue.deadline);
    const now = new Date();
    if (selected.getTime() < now.getTime()) {
      this.deadlineError = '* Cannot select past time';
      return;
    }

    const duplicate = this.allTasks.some(
      t => t.subject?.toLowerCase() === formValue.subject.trim().toLowerCase()
           && t !== this.editingTask
    );
    if (duplicate) {
      this.duplicateError = '* A task with this subject already exists';
      return;
    }

    const task: Task = { ...formValue, subject: formValue.subject.trim() };
    const editing = this.editingTask;

    this.isAdding = false;
    this.editingTask = null;
    this.taskForm.reset({ status: 'not started', priority: 'normal' });

    try {
      if (editing) {
        await this.taskService.updateTask({ ...editing, ...task });
      } else {
        await this.taskService.addTask(task);
      }
    } catch (err) {
      console.warn('Offline action (will sync later):', err);
    }

    this.updatePastDueTasks(); // ensure new tasks are checked
    this.applyFilter();

    const toast = await this.toastCtrl.create({
      message: 'Task Saved Successfully',
      duration: 1200,
      color: 'success',
    });
    toast.present();
  }

  editTask(task: Task) {
    this.isAdding = true;
    this.editingTask = task;
    this.taskForm.patchValue({
      subject: task.subject,
      deadline: task.deadline,
      status: task.status,
      priority: task.priority || 'normal',
    });

    setTimeout(() => {
      try { this.formContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
    }, 200);
  }

  async deleteTask(task: Task) {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete "${task.subject}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: async () => {
            try {
              await this.taskService.deleteTask(task);
              const toast = await this.toastCtrl.create({
                message: 'Task Deleted Successfully',
                duration: 1200,
                color: 'danger',
              });
              toast.present();
            } catch (err) {
              console.warn('Offline delete (will sync later):', err);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async toggleTaskStatus(task: Task) {
    const status = task.status;
    if (status !== 'pastDue') { // don't change pastDue automatically
      task.status = status === 'not started' ? 'in progress' :
                    status === 'in progress' ? 'completed' : 'not started';
      try {
        await this.taskService.updateTask(task);
      } catch (err) {
        console.warn('Offline status update (will sync later):', err);
      }
    }
    this.updatePastDueTasks();
    this.applyFilter();
  }

  async changeTaskStatus(task: Task, newStatus: string) {
    if (task.status === 'pastDue' && newStatus !== 'completed') return; // block invalid changes

    task.status = newStatus as Task['status'];

    try {
      await this.taskService.updateTask(task);
    } catch (err) {
      console.warn('Offline status update (will sync later):', err);
    }

    this.updatePastDueTasks();
    this.applyFilter();
  }

  // ---------------------------------------------------
  // Update Task Visibility Settings
  // ---------------------------------------------------
  async updateTaskVisibility() {
    // Default to all if none selected
    if (!this.selectedTaskVisibility || this.selectedTaskVisibility.length === 0) {
      this.selectedTaskVisibility = ['notStarted', 'inProgress', 'completed', 'pastDue'];
    }

    console.log("Task visibility updated:", this.selectedTaskVisibility);

    const user = await firstValueFrom(this.authService.user$);
    if (!user) return;

    const currentSettings = user.settings ?? {};

    // Save new visibility to user settings
    await this.authService.updateSettings(user.uid, {
      ...currentSettings,
      taskVisibility: this.selectedTaskVisibility
    });

    // Update local taskVisibility mapping for filtering
    this.taskVisibility = {
      showNotStarted: this.selectedTaskVisibility.includes('notStarted'),
      showInProgress: this.selectedTaskVisibility.includes('inProgress'),
      showCompleted: this.selectedTaskVisibility.includes('completed'),
      showPastDue: this.selectedTaskVisibility.includes('pastDue'),
    };

    // Re-apply filter so the UI updates immediately
    this.applyFilter();
  }

  // Get task priority class for styling
  getPriorityClass(task: Task): string {
    return `priority-${task.priority || 'normal'}`;
  }

  // Show ad (still on home page)
  showAd() {
    this.adService.showInterstitial();
  }
}



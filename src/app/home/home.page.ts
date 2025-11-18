// src/app/home/home.page.ts
import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Task } from '../services/auth.service';
import { TaskService } from '../services/task.service';
import { AdService } from '../services/ad';
import { Subscription, Observable } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ReactiveFormsModule],
})
export class HomePage implements OnInit, OnDestroy {
  // Observables & lists
  tasks$!: Observable<Task[]>;
  private tasksSub?: Subscription;
  allTasks: Task[] = [];        // full list from service
  filteredTasks: Task[] = [];   // shown list (search / filter)

  // Reactive form for add/edit
  taskForm!: FormGroup;
  isAdding = false;
  editingTask: Task | null = null;
  @ViewChild('formContainer') formContainer!: ElementRef;

  // UI / validation
  searchTerm = '';
  minDate: string;
  subjectError = '';
  deadlineError = '';
  duplicateError = '';

  // Pro & ads
  public isPro = false;
  private proStatusSub?: Subscription;

  // Section filter
  taskSection: 'all' | 'not started' | 'in progress' | 'completed' = 'all';

  constructor(
    private taskService: TaskService,
    private fb: FormBuilder,
    private router: Router,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private adService: AdService
  ) {
    const now = new Date();
    this.minDate = now.toISOString().slice(0, 16);
  }

  ngOnInit() {
    // Build reactive form
    this.taskForm = this.fb.group({
      subject: ['', Validators.required],
      deadline: ['', Validators.required],
      status: ['not started', Validators.required],
      priority: ['normal'],
    });

    // Subscribe to tasks Observable from TaskService
    this.tasks$ = this.taskService.tasks$;
    this.tasksSub = this.tasks$.subscribe(tasks => {
      // Update local list and refresh filtered view
      this.allTasks = tasks || [];
      this.applyFilter(); // keeps filteredTasks in sync
    });

    // Pro status subscription
    this.proStatusSub = this.adService.proStatus$.subscribe(status => {
      this.isPro = !!status;
    });
  }

  ngOnDestroy() {
    this.tasksSub?.unsubscribe();
    this.proStatusSub?.unsubscribe();
  }

  // --- Filtering / Sorting ---
  applyFilter() {
    this.filterAndSortTasks();
  }

  filterBySection() {
    this.filterAndSortTasks();
  }

  filterAndSortTasks() {
    const now = Date.now();
    let tasks = [...this.allTasks];

    // Section filter
    if (this.taskSection !== 'all') {
      tasks = tasks.filter(t => (t.status || 'not started') === this.taskSection);
    }

    // Search filter
    const term = this.searchTerm?.trim().toLowerCase() || '';
    if (term) {
      tasks = tasks.filter(task =>
        (task.subject || '').toLowerCase().includes(term) ||
        (task.status || '').toLowerCase().includes(term)
      );
    }

    // Mark overdue tasks
    tasks.forEach(task => {
      const deadlineTime = new Date(task.deadline).getTime();
      task.isOverdue = deadlineTime < now && task.status !== 'completed';
    });

    // Sort by deadline ascending
    tasks.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

    this.filteredTasks = tasks;
  }

  // Toggle the add/edit form
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

  // Add or update task (uses reactive form)
  async addTask() {
    // clear previous errors
    this.subjectError = '';
    this.deadlineError = '';
    this.duplicateError = '';

    // mark touched to show validation states
    this.taskForm.markAllAsTouched();
    const formValue = this.taskForm.value;

    // Basic validation
    if (!formValue.subject?.trim()) {
      this.subjectError = '* Required';
      return;
    }
    if (!formValue.deadline) {
      this.deadlineError = '* Required';
      return;
    }

    // Block past time
    const selected = new Date(formValue.deadline);
    const now = new Date();

    if (selected.getTime() < now.getTime()) {
      this.deadlineError = '* Cannot select past time';
      return;
    }

    // Duplicate check (case-insensitive), ignore the editingTask itself
    const duplicate = this.allTasks.some(
      t => t.subject?.toLowerCase() === formValue.subject.trim().toLowerCase()
           && t !== this.editingTask
    );
    if (duplicate) {
      this.duplicateError = '* A task with this subject already exists';
      return;
    }

    // Build final task object
    const task: Task = {
      ...formValue,
      subject: formValue.subject.trim(),
    };

    const editing = this.editingTask;

    // Reset UI/form immediately (optimistic)
    this.isAdding = false;
    this.editingTask = null;
    this.taskForm.reset({ status: 'not started', priority: 'normal' });

    try {
      if (editing) {
        // update existing
        await this.taskService.updateTask({ ...editing, ...task });
      } else {
      
        const hasLocalAdd = typeof this.taskService.addTaskLocally === 'function';
        if (hasLocalAdd) {
          
          const temp = this.taskService.addTaskLocally(task);
          try {
            const added = await this.taskService.addTask(task);
            
            if (this.taskService['_tasks'] && temp?.id) {
              
              const current = this.taskService['_tasks'].value || [];
              
              this.taskService['_tasks'].next(current.map(t => (t.id === temp.id ? added : t)));
            }
          } catch (err) {
           
            console.warn('Add task failed (will sync later):', err);
          }
        } else {
          // fallback: call addTask directly
          await this.taskService.addTask(task);
        }
      }
    } catch (err) {
      console.warn('Offline action (will sync later):', err);
    }

    // ensure filtered list updated
    this.applyFilter();
    

    // show toast
    const toast = await this.toastCtrl.create({
      message: 'Task saved successfully!',
      duration: 1200,
      color: 'success',
    });
    toast.present();
  }

  // Prepare editing
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

  // Delete with confirmation
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
                message: 'Task deleted successfully!',
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

  // Toggle status quickly (in UI + persist)
  async toggleTaskStatus(task: Task) {
    const status = (task.status || 'not started').toLowerCase().trim();
    task.status = status === 'not started' ? 'in progress' :
                  status === 'in progress' ? 'completed' : 'not started';
    try {
      await this.taskService.updateTask(task);
    } catch (err) {
      console.warn('Offline status update (will sync later):', err);
    }

    // refresh filter so status update reflects immediately
    this.applyFilter();
  }

  // Return CSS class for priority (if template uses it)
  getPriorityClass(task: Task): string {
    const priority = task.priority || 'normal';
    return `priority-${priority}`;
  }

  // Ads / Pro
  showAd() {
    this.adService.showInterstitial();
  }

  async goPro() {
    await this.adService.purchasePro();
    const alert = await this.alertCtrl.create({
      header: 'Upgrade Complete!',
      message: 'You are now a Pro user and have unlocked Task Priorities!',
      buttons: ['OK']
    });
    await alert.present();
  }
}

// src/app/components/task-list.component.ts
import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { TaskService } from '../services/task.service';
import { Task } from '../services/task';

@Component({
  selector: 'app-task-list',
  standalone: true,
  templateUrl: './task-list.component.html',
  styleUrls: ['./task-list.component.scss'],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule],
})
export class TaskListComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  groupedTasks: { [key: string]: Task[] } = {};
  taskForm!: FormGroup;
  isAdding = false;
  editingTask: Task | null = null;
  minDate: string;
  searchTerm = '';
  subjectError = '';
  deadlineError = '';
  duplicateError = '';
  private tasksSub?: Subscription;
  @ViewChild('formContainer') formContainer!: ElementRef;

  constructor(private fb: FormBuilder, private taskService: TaskService) {
    this.minDate = new Date().toISOString().split('T')[0];
  }

  ngOnInit() {
    this.tasksSub = this.taskService.tasks$.subscribe(tasks => {
      this.tasks = tasks;
      this.applyFilter();
    });

    this.taskForm = this.fb.group({
      subject: ['', Validators.required],
      deadline: ['', Validators.required],
      status: ['not started', Validators.required],
    });
  }

  ngOnDestroy() {
    this.tasksSub?.unsubscribe();
  }

  applyFilter() {
    const term = this.searchTerm.trim().toLowerCase();
    this.filteredTasks = !term
      ? [...this.tasks]
      : this.tasks.filter(task =>
          (task.subject || '').toLowerCase().includes(term) ||
          (task.status || '').toLowerCase().includes(term)
        );
    this.groupTasksByStatus();
  }

  groupTasksByStatus() {
    this.groupedTasks = { 'not started': [], 'in progress': [], 'completed': [] };
    for (const task of this.filteredTasks) {
      const status = task.status || 'not started';
      this.groupedTasks[status].push(task);
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

    const duplicate = this.tasks.some(
      t => (t.subject || '').toLowerCase() === formValue.subject.trim().toLowerCase() &&
           t !== this.editingTask
    );

    if (duplicate) {
      this.duplicateError = '* A task with this subject already exists';
      return;
    }

    const task: Task = {
      id: this.editingTask?.id,
      subject: formValue.subject.trim(),
      deadline: formValue.deadline,
      status: formValue.status,
    };

    if (this.editingTask) {
      await this.taskService.updateTask(task);
    } else {
      await this.taskService.addTask(task);
    }

    this.isAdding = false;
    this.editingTask = null;
    this.taskForm.reset({ status: 'not started' });
  }

  editTask(task: Task) {
    this.isAdding = true;
    this.editingTask = task;
    this.taskForm.patchValue({
      subject: task.subject,
      deadline: task.deadline,
      status: task.status,
    });
    setTimeout(() => {
      this.formContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  }

  async deleteTask(task: Task) {
    if (!confirm(`Delete task "${task.subject}"?`)) return;
    await this.taskService.deleteTask(task);
  }

  async updateStatus(task: Task, event: any) {
    const newStatus = event.detail.value;
    task.status = newStatus;
    await this.taskService.updateTask(task);
  }

  toggleAdd() {
    this.isAdding = !this.isAdding;
    this.editingTask = null;
    this.taskForm.reset({ status: 'not started' });
    this.duplicateError = '';
    this.subjectError = '';
    this.deadlineError = '';
    if (this.isAdding) {
      setTimeout(() => {
        this.formContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  }
}

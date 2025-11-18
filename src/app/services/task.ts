// src/app/services/task.ts 
export interface Task {
  id?: string;
  subject: string;   // main title
  deadline: string;
  status: 'not started' | 'in progress' | 'completed' | 'pastDue';
  priority?: 'low' | 'normal' | 'high';
}

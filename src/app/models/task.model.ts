export interface Task {
  id?: string;                 // Firestore document ID
  subject: string;             // main title
  deadline: string;            // ISO string
  status: 'not started' | 'in progress' | 'completed';
}

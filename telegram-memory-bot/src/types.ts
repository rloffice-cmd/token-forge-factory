// === Memory Types ===

export interface Memory {
  id: number;
  content: string;
  category: string;
  topic: string;
  tags: string[];
  source: MemorySource;
  importance: 'low' | 'medium' | 'high' | 'critical';
  created_at: Date;
  updated_at: Date;
}

export type MemorySource = 'direct' | 'forwarded' | 'email' | 'whatsapp' | 'chat' | 'voice';

export interface MemoryInsert {
  content: string;
  category: string;
  topic: string;
  tags: string[];
  source: MemorySource;
  importance: string;
}

// === Task Types ===

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: Date | null;
  reminder_at: Date | null;
  reminder_interval_hours: number | null;
  last_reminded_at: Date | null;
  snooze_until: Date | null;
  category: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TaskInsert {
  title: string;
  description?: string;
  priority?: string;
  due_date?: string;
  reminder_at?: string;
  reminder_interval_hours?: number;
  category?: string;
}

// === AI Extraction Types ===

export interface ExtractedMetadata {
  category: string;
  topic: string;
  tags: string[];
  importance: string;
  is_task: boolean;
  task_details?: {
    title: string;
    description: string;
    priority: string;
    due_date?: string;
    reminder_at?: string;
    reminder_interval_hours?: number;
  };
  summary: string;
}
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
  category: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TaskInsert {
  title: string;
  description?: string;
  priority?: string;
  due_date?: string;
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
  };
  summary: string;
}

export interface SearchResult {
  memory: Memory;
  relevance: number;
}

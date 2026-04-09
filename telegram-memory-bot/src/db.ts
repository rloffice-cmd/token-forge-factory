import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Memory, MemoryInsert, Task, TaskInsert } from './types';
import { escapeLike } from './utils';

let db: Database.Database;

export function initDb(): void {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'brain.db');

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  console.log(`✅ Database connected: ${dbPath}`);
}

function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

// === Schema Creation ===

export function createTables(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'כללי',
      topic TEXT NOT NULL DEFAULT '',
      tags TEXT DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'direct',
      importance TEXT NOT NULL DEFAULT 'medium',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
    CREATE INDEX IF NOT EXISTS idx_memories_topic ON memories(topic);
    CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
    CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      reminder_at TEXT,
      reminder_interval_hours REAL,
      last_reminded_at TEXT,
      snooze_until TEXT,
      category TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_reminder_at ON tasks(reminder_at);
  `);

  // FTS5 virtual table for fast Hebrew full-text search
  try {
    getDb().exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        content, category, topic, tags,
        content='memories',
        content_rowid='id',
        tokenize='unicode61'
      );
    `);
    // Create triggers to keep FTS in sync
    getDb().exec(`
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, content, category, topic, tags) VALUES (new.id, new.content, new.category, new.topic, new.tags);
      END;
      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content, category, topic, tags) VALUES('delete', old.id, old.content, old.category, old.topic, old.tags);
      END;
      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content, category, topic, tags) VALUES('delete', old.id, old.content, old.category, old.topic, old.tags);
        INSERT INTO memories_fts(rowid, content, category, topic, tags) VALUES (new.id, new.content, new.category, new.topic, new.tags);
      END;
    `);
    // Only rebuild FTS if it's out of sync (empty FTS with existing memories)
    const ftsCount = getDb().prepare('SELECT COUNT(*) as c FROM memories_fts').get() as any;
    const memCount = getDb().prepare('SELECT COUNT(*) as c FROM memories').get() as any;
    if (ftsCount.c === 0 && memCount.c > 0) {
      console.log('🔄 Rebuilding FTS index...');
      getDb().exec(`INSERT INTO memories_fts(memories_fts) VALUES('rebuild');`);
    }
  } catch (err: any) {
    // FTS already exists or not supported - triggers already exist
    if (!err.message?.includes('already exists')) {
      console.warn('FTS5 setup warning:', err.message);
    }
  }

  // Migration: add new columns to existing tables (safe to re-run)
  const migrations = [
    `ALTER TABLE tasks ADD COLUMN reminder_interval_hours REAL`,
    `ALTER TABLE tasks ADD COLUMN last_reminded_at TEXT`,
    `ALTER TABLE tasks ADD COLUMN snooze_until TEXT`,
  ];
  for (const sql of migrations) {
    try { getDb().exec(sql); } catch { /* column already exists */ }
  }

  console.log('✅ Database tables created successfully');
}

// === Row Mappers ===

function rowToMemory(row: any): Memory {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags || '[]');
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    content: row.content,
    category: row.category,
    topic: row.topic,
    tags,
    source: row.source,
    importance: row.importance,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

function rowToTask(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date ? new Date(row.due_date) : null,
    reminder_at: row.reminder_at ? new Date(row.reminder_at) : null,
    reminder_interval_hours: row.reminder_interval_hours ?? null,
    last_reminded_at: row.last_reminded_at ? new Date(row.last_reminded_at) : null,
    snooze_until: row.snooze_until ? new Date(row.snooze_until) : null,
    category: row.category ?? null,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

// === Memory Operations ===

export function insertMemory(data: MemoryInsert): Memory {
  const stmt = getDb().prepare(
    `INSERT INTO memories (content, category, topic, tags, source, importance)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    data.content, data.category, data.topic, JSON.stringify(data.tags), data.source, data.importance
  );
  const row = getDb().prepare('SELECT * FROM memories WHERE id = ?').get(result.lastInsertRowid);
  return rowToMemory(row);
}

export function searchMemories(query: string, limit = 20): Memory[] {
  // Try FTS5 first (fast, ranked)
  try {
    const rows = getDb().prepare(
      `SELECT m.* FROM memories m
       JOIN memories_fts fts ON m.id = fts.rowid
       WHERE memories_fts MATCH ?
       ORDER BY rank
       LIMIT ?`
    ).all(query, limit);
    if (rows.length > 0) return rows.map(rowToMemory);
  } catch {
    // FTS query failed (invalid syntax) - fall through to LIKE
  }

  // Fallback: LIKE search with escaped special chars
  const escaped = escapeLike(query);
  const pattern = `%${escaped}%`;
  const rows = getDb().prepare(
    `SELECT * FROM memories
     WHERE content LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\' OR topic LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\'
     ORDER BY created_at DESC
     LIMIT ?`
  ).all(pattern, pattern, pattern, pattern, limit);
  return rows.map(rowToMemory);
}

export function getRecentMemories(limit = 10): Memory[] {
  const rows = getDb().prepare(
    `SELECT * FROM memories ORDER BY created_at DESC LIMIT ?`
  ).all(limit);
  return rows.map(rowToMemory);
}

export function getMemoryStats(): {
  total: number;
  categories: { category: string; count: number }[];
  recent_count: number;
} {
  const total = getDb().prepare('SELECT COUNT(*) as total FROM memories').get() as any;
  const categories = getDb().prepare(
    `SELECT category, COUNT(*) as count FROM memories GROUP BY category ORDER BY count DESC LIMIT 10`
  ).all() as any[];
  const recent = getDb().prepare(
    `SELECT COUNT(*) as count FROM memories WHERE created_at > datetime('now', '-7 days')`
  ).get() as any;

  return {
    total: total.total,
    categories,
    recent_count: recent.count,
  };
}

export function deleteMemory(id: number): boolean {
  const result = getDb().prepare('DELETE FROM memories WHERE id = ?').run(id);
  return result.changes > 0;
}

// === Task Operations ===

export function insertTask(data: TaskInsert): Task {
  const stmt = getDb().prepare(
    `INSERT INTO tasks (title, description, priority, due_date, reminder_at, reminder_interval_hours, category)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    data.title,
    data.description || null,
    data.priority || 'medium',
    data.due_date || null,
    data.reminder_at || null,
    data.reminder_interval_hours ?? null,
    data.category || null
  );
  const row = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  return rowToTask(row);
}

export function getTasks(status?: string): Task[] {
  if (status) {
    const rows = getDb().prepare(
      `SELECT * FROM tasks WHERE status = ? ORDER BY
        CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
        due_date ASC, created_at DESC`
    ).all(status);
    return rows.map(rowToTask);
  }
  const rows = getDb().prepare(
    `SELECT * FROM tasks WHERE status NOT IN ('done', 'cancelled') ORDER BY
      CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
      due_date ASC, created_at DESC`
  ).all();
  return rows.map(rowToTask);
}

export function updateTaskStatus(id: number, status: string): Task | null {
  getDb().prepare(
    `UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, id);
  const row = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  return row ? rowToTask(row) : null;
}

export function deleteTask(id: number): boolean {
  const result = getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getDueTasks(): Task[] {
  const rows = getDb().prepare(
    `SELECT * FROM tasks
     WHERE status = 'pending' AND due_date IS NOT NULL AND due_date <= datetime('now', '+1 day')
     ORDER BY due_date ASC`
  ).all();
  return rows.map(rowToTask);
}

// === Reminder Operations ===

export function getTasksDueForReminder(): Task[] {
  const now = new Date().toISOString();
  const rows = getDb().prepare(
    `SELECT * FROM tasks
     WHERE status IN ('pending', 'in_progress')
       AND reminder_at IS NOT NULL
       AND reminder_at <= ?
       AND (snooze_until IS NULL OR snooze_until <= ?)
     ORDER BY reminder_at ASC`
  ).all(now, now);
  return rows.map(rowToTask);
}

export function markTaskReminded(id: number): void {
  const now = new Date().toISOString();
  const task = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  if (!task) return;

  if (task.reminder_interval_hours) {
    const nextReminder = new Date(Date.now() + task.reminder_interval_hours * 3600000).toISOString();
    getDb().prepare(
      `UPDATE tasks SET last_reminded_at = ?, reminder_at = ?, updated_at = ? WHERE id = ?`
    ).run(now, nextReminder, now, id);
  } else {
    getDb().prepare(
      `UPDATE tasks SET last_reminded_at = ?, reminder_at = NULL, updated_at = ? WHERE id = ?`
    ).run(now, now, id);
  }
}

export function snoozeTask(id: number, hours: number): Task | null {
  const snoozeUntil = new Date(Date.now() + hours * 3600000).toISOString();
  const now = new Date().toISOString();
  getDb().prepare(
    `UPDATE tasks SET snooze_until = ?, updated_at = ? WHERE id = ?`
  ).run(snoozeUntil, now, id);
  const row = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  return row ? rowToTask(row) : null;
}

export function getTaskById(id: number): Task | null {
  const row = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  return row ? rowToTask(row) : null;
}

// === Bulk Operations ===

export function getAllMemoriesForContext(limit = 50): Memory[] {
  const rows = getDb().prepare(
    `SELECT * FROM memories ORDER BY created_at DESC LIMIT ?`
  ).all(limit);
  return rows.map(rowToMemory);
}

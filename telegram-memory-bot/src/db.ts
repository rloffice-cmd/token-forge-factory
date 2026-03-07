import Database from 'better-sqlite3';
import path from 'path';
import { Memory, MemoryInsert, Task, TaskInsert } from './types';

let db: Database.Database;

export function initDb(): void {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'brain.db');

  // Ensure data directory exists
  const dir = path.dirname(dbPath);
  const fs = require('fs');
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

export async function createTables(): Promise<void> {
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
      category TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
  `);
  console.log('✅ Database tables created successfully');
}

// === Row to Memory ===

function rowToMemory(row: any): Memory {
  return {
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

function rowToTask(row: any): Task {
  return {
    ...row,
    due_date: row.due_date ? new Date(row.due_date) : null,
    reminder_at: row.reminder_at ? new Date(row.reminder_at) : null,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

// === Memory Operations ===

export async function insertMemory(data: MemoryInsert): Promise<Memory> {
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

export async function searchMemories(query: string, limit = 20): Promise<Memory[]> {
  const pattern = `%${query}%`;
  const rows = getDb().prepare(
    `SELECT * FROM memories
     WHERE content LIKE ? OR category LIKE ? OR topic LIKE ? OR tags LIKE ?
     ORDER BY created_at DESC
     LIMIT ?`
  ).all(pattern, pattern, pattern, pattern, limit);
  return rows.map(rowToMemory);
}

export async function getMemoriesByCategory(category: string, limit = 20): Promise<Memory[]> {
  const rows = getDb().prepare(
    `SELECT * FROM memories WHERE category LIKE ? ORDER BY created_at DESC LIMIT ?`
  ).all(`%${category}%`, limit);
  return rows.map(rowToMemory);
}

export async function getMemoriesByTag(tag: string, limit = 20): Promise<Memory[]> {
  const rows = getDb().prepare(
    `SELECT * FROM memories WHERE tags LIKE ? ORDER BY created_at DESC LIMIT ?`
  ).all(`%${tag}%`, limit);
  return rows.map(rowToMemory);
}

export async function getRecentMemories(limit = 10): Promise<Memory[]> {
  const rows = getDb().prepare(
    `SELECT * FROM memories ORDER BY created_at DESC LIMIT ?`
  ).all(limit);
  return rows.map(rowToMemory);
}

export async function getMemoryStats(): Promise<{
  total: number;
  categories: { category: string; count: number }[];
  recent_count: number;
}> {
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

export async function deleteMemory(id: number): Promise<boolean> {
  const result = getDb().prepare('DELETE FROM memories WHERE id = ?').run(id);
  return result.changes > 0;
}

// === Task Operations ===

export async function insertTask(data: TaskInsert): Promise<Task> {
  const stmt = getDb().prepare(
    `INSERT INTO tasks (title, description, priority, due_date, category)
     VALUES (?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    data.title, data.description || null, data.priority || 'medium', data.due_date || null, data.category || null
  );
  const row = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  return rowToTask(row);
}

export async function getTasks(status?: string): Promise<Task[]> {
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

export async function updateTaskStatus(id: number, status: string): Promise<Task | null> {
  getDb().prepare(
    `UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, id);
  const row = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  return row ? rowToTask(row) : null;
}

export async function deleteTask(id: number): Promise<boolean> {
  const result = getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

export async function getDueTasks(): Promise<Task[]> {
  const rows = getDb().prepare(
    `SELECT * FROM tasks
     WHERE status = 'pending' AND due_date IS NOT NULL AND due_date <= datetime('now', '+1 day')
     ORDER BY due_date ASC`
  ).all();
  return rows.map(rowToTask);
}

// === Bulk Operations ===

export async function getAllMemoriesForContext(limit = 50): Promise<Memory[]> {
  const rows = getDb().prepare(
    `SELECT * FROM memories ORDER BY created_at DESC LIMIT ?`
  ).all(limit);
  return rows.map(rowToMemory);
}

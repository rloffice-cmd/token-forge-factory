import { Pool, PoolClient } from 'pg';
import { Memory, MemoryInsert, Task, TaskInsert } from './types';

let pool: Pool;

export function initDb(): Pool {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  return pool;
}

export function getPool(): Pool {
  if (!pool) throw new Error('Database not initialized. Call initDb() first.');
  return pool;
}

// === Schema Creation ===

export async function createTables(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS memories (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        category VARCHAR(100) NOT NULL DEFAULT 'כללי',
        topic VARCHAR(200) NOT NULL DEFAULT '',
        tags TEXT[] DEFAULT '{}',
        source VARCHAR(50) NOT NULL DEFAULT 'direct',
        importance VARCHAR(20) NOT NULL DEFAULT 'medium',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
      CREATE INDEX IF NOT EXISTS idx_memories_topic ON memories(topic);
      CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories USING GIN(tags);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);

      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        due_date TIMESTAMPTZ,
        reminder_at TIMESTAMPTZ,
        category VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    `);
    console.log('✅ Database tables created successfully');
  } finally {
    client.release();
  }
}

// === Memory Operations ===

export async function insertMemory(data: MemoryInsert): Promise<Memory> {
  const result = await getPool().query(
    `INSERT INTO memories (content, category, topic, tags, source, importance)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.content, data.category, data.topic, data.tags, data.source, data.importance]
  );
  return result.rows[0];
}

export async function searchMemories(query: string, limit = 20): Promise<Memory[]> {
  // Full-text search across content, category, topic, and tags
  const result = await getPool().query(
    `SELECT *,
       ts_rank(
         to_tsvector('simple', content || ' ' || category || ' ' || topic || ' ' || array_to_string(tags, ' ')),
         plainto_tsquery('simple', $1)
       ) as rank
     FROM memories
     WHERE
       content ILIKE '%' || $1 || '%'
       OR category ILIKE '%' || $1 || '%'
       OR topic ILIKE '%' || $1 || '%'
       OR $1 = ANY(tags)
     ORDER BY rank DESC, created_at DESC
     LIMIT $2`,
    [query, limit]
  );
  return result.rows;
}

export async function getMemoriesByCategory(category: string, limit = 20): Promise<Memory[]> {
  const result = await getPool().query(
    `SELECT * FROM memories WHERE category ILIKE $1 ORDER BY created_at DESC LIMIT $2`,
    [category, limit]
  );
  return result.rows;
}

export async function getMemoriesByTag(tag: string, limit = 20): Promise<Memory[]> {
  const result = await getPool().query(
    `SELECT * FROM memories WHERE $1 = ANY(tags) ORDER BY created_at DESC LIMIT $2`,
    [tag, limit]
  );
  return result.rows;
}

export async function getRecentMemories(limit = 10): Promise<Memory[]> {
  const result = await getPool().query(
    `SELECT * FROM memories ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function getMemoryStats(): Promise<{
  total: number;
  categories: { category: string; count: number }[];
  recent_count: number;
}> {
  const totalResult = await getPool().query('SELECT COUNT(*) as total FROM memories');
  const catResult = await getPool().query(
    `SELECT category, COUNT(*) as count FROM memories GROUP BY category ORDER BY count DESC LIMIT 10`
  );
  const recentResult = await getPool().query(
    `SELECT COUNT(*) as count FROM memories WHERE created_at > NOW() - INTERVAL '7 days'`
  );
  return {
    total: parseInt(totalResult.rows[0].total),
    categories: catResult.rows,
    recent_count: parseInt(recentResult.rows[0].count),
  };
}

export async function deleteMemory(id: number): Promise<boolean> {
  const result = await getPool().query('DELETE FROM memories WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

// === Task Operations ===

export async function insertTask(data: TaskInsert): Promise<Task> {
  const result = await getPool().query(
    `INSERT INTO tasks (title, description, priority, due_date, category)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.title, data.description || null, data.priority || 'medium', data.due_date || null, data.category || null]
  );
  return result.rows[0];
}

export async function getTasks(status?: string): Promise<Task[]> {
  if (status) {
    const result = await getPool().query(
      `SELECT * FROM tasks WHERE status = $1 ORDER BY
        CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
        due_date ASC NULLS LAST, created_at DESC`,
      [status]
    );
    return result.rows;
  }
  const result = await getPool().query(
    `SELECT * FROM tasks WHERE status NOT IN ('done', 'cancelled') ORDER BY
      CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
      due_date ASC NULLS LAST, created_at DESC`
  );
  return result.rows;
}

export async function updateTaskStatus(id: number, status: string): Promise<Task | null> {
  const result = await getPool().query(
    `UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return result.rows[0] || null;
}

export async function deleteTask(id: number): Promise<boolean> {
  const result = await getPool().query('DELETE FROM tasks WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function getDueTasks(): Promise<Task[]> {
  const result = await getPool().query(
    `SELECT * FROM tasks
     WHERE status = 'pending' AND due_date IS NOT NULL AND due_date <= NOW() + INTERVAL '1 day'
     ORDER BY due_date ASC`
  );
  return result.rows;
}

// === Bulk Operations ===

export async function getAllMemoriesForContext(limit = 50): Promise<Memory[]> {
  const result = await getPool().query(
    `SELECT * FROM memories ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

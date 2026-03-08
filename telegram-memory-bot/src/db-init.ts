import 'dotenv/config';
import { initDb, createTables } from './db';

function main() {
  console.log('🔧 Initializing database...');
  initDb();
  createTables();
  console.log('✅ Database initialized successfully!');
}

try {
  main();
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
}

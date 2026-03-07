import 'dotenv/config';
import { initDb, createTables } from './db';

async function main() {
  console.log('🔧 Initializing database...');
  initDb();
  await createTables();
  console.log('✅ Database initialized successfully!');
}

main().catch(error => {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
});

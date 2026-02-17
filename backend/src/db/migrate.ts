import { pool } from './connection';
import * as migration001 from './migrations/001_initial_schema';

interface Migration {
  id: string;
  up: (pool: typeof import('./connection').pool) => Promise<void>;
  down: (pool: typeof import('./connection').pool) => Promise<void>;
}

const migrations: Migration[] = [
  { id: migration001.id, up: migration001.up, down: migration001.down },
];

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getExecutedMigrations(): Promise<Set<string>> {
  const result = await pool.query('SELECT id FROM migrations ORDER BY executed_at');
  return new Set(result.rows.map((r: { id: string }) => r.id));
}

export async function runMigrations() {
  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();

  for (const migration of migrations) {
    if (executed.has(migration.id)) {
      console.log(`Migration ${migration.id} already executed, skipping`);
      continue;
    }
    console.log(`Running migration: ${migration.id}`);
    await migration.up(pool);
    await pool.query('INSERT INTO migrations (id) VALUES ($1) ON CONFLICT DO NOTHING', [migration.id]);
    console.log(`Migration ${migration.id} completed`);
  }

  console.log('All migrations complete');
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

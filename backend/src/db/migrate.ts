import { Pool } from 'pg';
import { config } from '../config';
import * as migration001 from './migrations/001_initial_schema';
import * as migration002 from './migrations/002_add_product_fields';
import * as migration003 from './migrations/003_add_output_created_by_and_final_copy';
import * as migration004 from './migrations/004_social_media_tables';

/**
 * Migrations require raw SQL (DDL) which the Supabase query builder cannot
 * execute.  We keep a dedicated Pool here solely for migration use.
 * All regular application queries go through the Supabase client in
 * connection.ts.
 */
const migrationPool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 2,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
});

interface Migration {
  id: string;
  up: (pool: Pool) => Promise<void>;
  down: (pool: Pool) => Promise<void>;
}

const migrations: Migration[] = [
  { id: migration001.id, up: migration001.up, down: migration001.down },
  { id: migration002.id, up: migration002.up, down: migration002.down },
  { id: migration003.id, up: migration003.up, down: migration003.down },
  { id: migration004.id, up: migration004.up, down: migration004.down },
];

async function ensureMigrationsTable() {
  await migrationPool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getExecutedMigrations(): Promise<Set<string>> {
  try {
    const result = await migrationPool.query('SELECT id FROM migrations ORDER BY executed_at');
    return new Set(result.rows.map((r: { id: string }) => r.id));
  } catch {
    // Table may not exist yet on first run — fall back to empty set
    return new Set<string>();
  }
}

export async function runMigrations() {
  try {
    // Test connectivity first — if the database is unreachable (e.g. external
    // Supabase with no direct PG access) we skip migrations gracefully.
    try {
      const client = await migrationPool.connect();
      client.release();
    } catch (connErr) {
      console.warn(
        'Could not connect to PostgreSQL for migrations (this is expected when ' +
        'using an external Supabase instance without direct DB access). Skipping migrations.',
        (connErr as Error).message,
      );
      await migrationPool.end().catch(() => {});
      return;
    }

    await ensureMigrationsTable();
    const executed = await getExecutedMigrations();

    for (const migration of migrations) {
      if (executed.has(migration.id)) {
        console.log(`Migration ${migration.id} already executed, skipping`);
        continue;
      }
      console.log(`Running migration: ${migration.id}`);
      await migration.up(migrationPool);
      await migrationPool.query(
        'INSERT INTO migrations (id) VALUES ($1) ON CONFLICT DO NOTHING',
        [migration.id],
      );
      console.log(`Migration ${migration.id} completed`);
    }

    console.log('All migrations complete');
  } finally {
    await migrationPool.end().catch(() => {});
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

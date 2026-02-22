import { query, supabase } from './connection';
import * as migration001 from './migrations/001_initial_schema';
import * as migration002 from './migrations/002_add_product_fields';
import * as migration003 from './migrations/003_add_output_created_by_and_final_copy';
import * as migration004 from './migrations/004_social_media_tables';

// Migration files accept a Pool parameter but only use .query() on it.
// We cast them here so they work with our lightweight migrationClient wrapper.
type MigrationFn = (client: { query: (sql: string) => Promise<unknown> }) => Promise<void>;

interface Migration {
  id: string;
  up: MigrationFn;
  down: MigrationFn;
}

const migrations: Migration[] = [
  { id: migration001.id, up: migration001.up as unknown as MigrationFn, down: migration001.down as unknown as MigrationFn },
  { id: migration002.id, up: migration002.up as unknown as MigrationFn, down: migration002.down as unknown as MigrationFn },
  { id: migration003.id, up: migration003.up as unknown as MigrationFn, down: migration003.down as unknown as MigrationFn },
  { id: migration004.id, up: migration004.up as unknown as MigrationFn, down: migration004.down as unknown as MigrationFn },
];

/**
 * Thin wrapper that satisfies the `{ query(sql) }` interface expected by
 * each migration file while routing through the Supabase `exec_sql` RPC.
 */
const migrationClient = {
  async query(sql: string) {
    return query(sql);
  },
};

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getExecutedMigrations(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('migrations')
    .select('id')
    .order('executed_at', { ascending: true });

  if (error) {
    // Table may not exist yet on first run — fall back to empty set
    console.warn('Could not read migrations table (may not exist yet):', error.message);
    return new Set<string>();
  }

  return new Set((data || []).map((r: { id: string }) => r.id));
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
    await migration.up(migrationClient);
    await supabase.from('migrations').upsert({ id: migration.id }, { onConflict: 'id' });
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

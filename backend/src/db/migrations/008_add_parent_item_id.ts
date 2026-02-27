import { Pool } from 'pg';

export const id = '008_add_parent_item_id';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    ALTER TABLE content_items
      ADD COLUMN IF NOT EXISTS parent_item_id UUID DEFAULT NULL
        REFERENCES content_items(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_content_items_parent_item_id
      ON content_items(parent_item_id);
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query(`
    DROP INDEX IF EXISTS idx_content_items_parent_item_id;
    ALTER TABLE content_items DROP COLUMN IF EXISTS parent_item_id;
  `);
}

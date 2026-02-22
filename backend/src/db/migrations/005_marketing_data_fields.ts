import { Pool } from 'pg';

export const id = '005_marketing_data_fields';

export async function up(pool: Pool): Promise<void> {
    // Step 1: Normalise empty strings to NULL so the JSONB cast is clean.
    await pool.query(`
    UPDATE content_items SET campaign_goal = NULL WHERE campaign_goal = '';
    UPDATE content_items SET direction     = NULL WHERE direction     = '';
  `);

    // Step 2: Convert TEXT columns to JSONB.
    // to_jsonb(text) wraps the value as a JSON string (e.g. "my goal"),
    // which the frontend already handles as a legacy string format.
    await pool.query(`
    ALTER TABLE content_items
      ALTER COLUMN campaign_goal TYPE jsonb USING to_jsonb(campaign_goal),
      ALTER COLUMN direction     TYPE jsonb USING to_jsonb(direction);
  `);

    // Step 3: Add target_audience column.
    await pool.query(`
    ALTER TABLE content_items
      ADD COLUMN IF NOT EXISTS target_audience jsonb;
  `);
}

export async function down(pool: Pool): Promise<void> {
    await pool.query(`
    ALTER TABLE content_items
      DROP COLUMN IF EXISTS target_audience;

    ALTER TABLE content_items
      ALTER COLUMN campaign_goal TYPE text USING campaign_goal::text,
      ALTER COLUMN direction TYPE text USING direction::text;
  `);
}

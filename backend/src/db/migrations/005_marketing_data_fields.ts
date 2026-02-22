import { Pool } from 'pg';

export const id = '005_marketing_data_fields';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    -- Convert campaign_goal from TEXT to JSONB, preserving existing string values
    ALTER TABLE content_items
      ALTER COLUMN campaign_goal TYPE JSONB
        USING CASE
          WHEN campaign_goal IS NULL OR campaign_goal = '' THEN 'null'::jsonb
          ELSE to_jsonb(campaign_goal)
        END;

    ALTER TABLE content_items
      ALTER COLUMN campaign_goal SET DEFAULT 'null'::jsonb;

    -- Convert direction from TEXT to JSONB, preserving existing string values
    ALTER TABLE content_items
      ALTER COLUMN direction TYPE JSONB
        USING CASE
          WHEN direction IS NULL OR direction = '' THEN 'null'::jsonb
          ELSE to_jsonb(direction)
        END;

    ALTER TABLE content_items
      ALTER COLUMN direction SET DEFAULT 'null'::jsonb;

    -- Add target_audience column
    ALTER TABLE content_items
      ADD COLUMN IF NOT EXISTS target_audience JSONB DEFAULT 'null'::jsonb;

    -- Add product_id column to link back to the products table
    ALTER TABLE content_items
      ADD COLUMN IF NOT EXISTS product_id TEXT DEFAULT NULL;
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query(`
    ALTER TABLE content_items
      DROP COLUMN IF EXISTS target_audience;

    ALTER TABLE content_items
      DROP COLUMN IF EXISTS product_id;

    ALTER TABLE content_items
      ALTER COLUMN direction TYPE TEXT
        USING CASE
          WHEN direction IS NULL THEN ''
          WHEN jsonb_typeof(direction) = 'string' THEN direction #>> '{}'
          ELSE direction::text
        END;

    ALTER TABLE content_items
      ALTER COLUMN direction SET DEFAULT '';

    ALTER TABLE content_items
      ALTER COLUMN campaign_goal TYPE TEXT
        USING CASE
          WHEN campaign_goal IS NULL THEN ''
          WHEN jsonb_typeof(campaign_goal) = 'string' THEN campaign_goal #>> '{}'
          ELSE campaign_goal::text
        END;

    ALTER TABLE content_items
      ALTER COLUMN campaign_goal SET DEFAULT '';
  `);
}

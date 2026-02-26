import { Pool } from 'pg';

export const id = '006_calendar_notes';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendar_notes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      date DATE NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      color VARCHAR(30) DEFAULT NULL,
      visibility VARCHAR(10) NOT NULL DEFAULT 'team'
        CHECK (visibility IN ('private', 'team')),
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_calendar_notes_date ON calendar_notes(date);
    CREATE INDEX IF NOT EXISTS idx_calendar_notes_created_by ON calendar_notes(created_by);
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query(`
    DROP TABLE IF EXISTS calendar_notes;
  `);
}

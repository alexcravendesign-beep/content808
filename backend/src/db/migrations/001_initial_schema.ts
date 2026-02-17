import { Pool } from 'pg';

export const id = '001_initial_schema';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS content_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      brand VARCHAR(255) NOT NULL,
      product_url TEXT NOT NULL DEFAULT '',
      campaign_goal TEXT NOT NULL DEFAULT '',
      direction TEXT NOT NULL DEFAULT '',
      pivot_notes TEXT NOT NULL DEFAULT '',
      platform VARCHAR(100) NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'idea'
        CHECK (status IN ('idea','draft','review','approved','blocked','scheduled','published')),
      due_date TIMESTAMPTZ,
      publish_date TIMESTAMPTZ,
      assignee VARCHAR(255),
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
    CREATE INDEX IF NOT EXISTS idx_content_items_publish_date ON content_items(publish_date);
    CREATE INDEX IF NOT EXISTS idx_content_items_due_date ON content_items(due_date);
    CREATE INDEX IF NOT EXISTS idx_content_items_assignee ON content_items(assignee);
    CREATE INDEX IF NOT EXISTS idx_content_items_platform ON content_items(platform);

    CREATE TABLE IF NOT EXISTS content_comments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
      user_id VARCHAR(255) NOT NULL,
      user_name VARCHAR(255) NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_content_comments_item ON content_comments(content_item_id);

    CREATE TABLE IF NOT EXISTS content_item_outputs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
      output_type VARCHAR(100) NOT NULL,
      output_data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_content_item_outputs_item ON content_item_outputs(content_item_id);

    CREATE TABLE IF NOT EXISTS plugin_registry (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      type VARCHAR(20) NOT NULL CHECK (type IN ('panel','widget','action')),
      enabled BOOLEAN NOT NULL DEFAULT false,
      config JSONB NOT NULL DEFAULT '{}',
      mount_point VARCHAR(255) NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      entity_type VARCHAR(100) NOT NULL,
      entity_id UUID NOT NULL,
      action VARCHAR(100) NOT NULL,
      actor VARCHAR(255) NOT NULL,
      actor_role VARCHAR(20) NOT NULL DEFAULT 'staff',
      details JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

    CREATE TABLE IF NOT EXISTS migrations (
      id VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query(`
    DROP TABLE IF EXISTS audit_log;
    DROP TABLE IF EXISTS plugin_registry;
    DROP TABLE IF EXISTS content_item_outputs;
    DROP TABLE IF EXISTS content_comments;
    DROP TABLE IF EXISTS content_items;
    DROP TABLE IF EXISTS migrations;
  `);
}

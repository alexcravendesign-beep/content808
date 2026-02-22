import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

/**
 * Shared Supabase client instance used across the entire backend.
 * Use the query-builder API (supabase.from(...).select(), .insert(), etc.)
 * for all application queries.
 *
 * Migrations are the only exception – they use a dedicated pg Pool in
 * migrate.ts because DDL statements require raw SQL.
 */
export const supabase: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.anonKey,
);

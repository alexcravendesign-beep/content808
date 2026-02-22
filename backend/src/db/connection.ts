import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

/**
 * Shared Supabase client instance used across the entire backend.
 * Prefer the query-builder API (supabase.from(...).select(), etc.) for
 * simple CRUD. Fall back to the `query()` helper below only for complex
 * SQL that the builder cannot express.
 */
export const supabase: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.anonKey,
);

/**
 * Execute a raw SQL query through the Supabase `exec_sql` database
 * function.  This preserves the slow-query logging (>1 s) from the
 * original pg-based implementation.
 *
 * The remote database must expose an `exec_sql(query_text text,
 * query_params jsonb)` function that returns SETOF json.
 */
export async function query(text: string, params?: unknown[]) {
  const start = Date.now();

  const { data, error } = await supabase.rpc('exec_sql', {
    query_text: text,
    query_params: params || [],
  });

  const duration = Date.now() - start;
  if (duration > 1000) {
    console.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}`);
  }

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  // Normalise to match the old pg result shape: { rows: [...] }
  const rows = Array.isArray(data) ? data : [];
  return { rows };
}

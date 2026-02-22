import { supabase } from '../db/connection';
import { UserRole } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AuditEntry {
  entityType: string;
  entityId: string;
  action: string;
  actor: string;
  actorRole: UserRole;
  details?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry) {
  const id = uuidv4();
  const { error } = await supabase.from('audit_log').insert({
    id,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    action: entry.action,
    actor: entry.actor,
    actor_role: entry.actorRole,
    details: entry.details || {},
  });
  if (error) {
    throw new Error(`Failed to insert audit log: ${error.message}`);
  }
  return id;
}

export async function getAuditLog(entityType: string, entityId: string) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  if (error) {
    throw new Error(`Failed to fetch audit log: ${error.message}`);
  }
  return data || [];
}

export async function getRecentAuditLog(limit = 50) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`Failed to fetch recent audit log: ${error.message}`);
  }
  return data || [];
}

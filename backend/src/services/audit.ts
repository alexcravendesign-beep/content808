import { query } from '../db/connection';
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
  await query(
    `INSERT INTO audit_log (id, entity_type, entity_id, action, actor, actor_role, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      entry.entityType,
      entry.entityId,
      entry.action,
      entry.actor,
      entry.actorRole,
      JSON.stringify(entry.details || {}),
    ]
  );
  return id;
}

export async function getAuditLog(entityType: string, entityId: string) {
  const result = await query(
    `SELECT * FROM audit_log WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC`,
    [entityType, entityId]
  );
  return result.rows;
}

export async function getRecentAuditLog(limit = 50) {
  const result = await query(
    `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

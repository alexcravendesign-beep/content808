import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { body, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { logAudit, getAuditLog } from '../services/audit';
import { canTransition, getValidTransitions, getAllStatuses } from '../services/transitions';
import { requireRole } from '../middleware/auth';
import { ContentStatus } from '../types';

const router = Router();

function handleValidation(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
}

router.get('/items', async (req: Request, res: Response) => {
  try {
    const { status, platform, assignee, brand, search } = req.query;
    let sql = 'SELECT * FROM content_items WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      sql += ` AND status = $${idx++}`;
      params.push(status);
    }
    if (platform) {
      sql += ` AND platform = $${idx++}`;
      params.push(platform);
    }
    if (assignee) {
      sql += ` AND assignee = $${idx++}`;
      params.push(assignee);
    }
    if (brand) {
      sql += ` AND brand ILIKE $${idx++}`;
      params.push(`%${brand}%`);
    }
    if (search) {
      sql += ` AND (brand ILIKE $${idx} OR campaign_goal ILIKE $${idx} OR direction ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    sql += ' ORDER BY updated_at DESC';
    const result = await query(sql, params);
    res.json({ items: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

router.get('/items/:id', [param('id').isUUID()], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const result = await query('SELECT * FROM content_items WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const item = result.rows[0];
    const validTransitions = req.user
      ? getValidTransitions(item.status, req.user.role)
      : [];
    res.json({ ...item, valid_transitions: validTransitions });
  } catch (err) {
    console.error('Error fetching item:', err);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

router.post(
  '/items',
  [
    body('brand').notEmpty().trim(),
    body('platform').optional().trim(),
    body('product_url').optional().trim(),
    body('campaign_goal').optional().trim(),
    body('direction').optional().trim(),
    body('pivot_notes').optional().trim(),
    body('due_date').optional({ nullable: true }).isISO8601(),
    body('publish_date').optional({ nullable: true }).isISO8601(),
    body('assignee').optional({ nullable: true }).trim(),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const id = uuidv4();
      const {
        brand, product_url = '', campaign_goal = '', direction = '',
        pivot_notes = '', platform = '', due_date = null,
        publish_date = null, assignee = null
      } = req.body;

      await query(
        `INSERT INTO content_items (id, brand, product_url, campaign_goal, direction, pivot_notes, platform, status, due_date, publish_date, assignee, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'idea',$8,$9,$10,$11)`,
        [id, brand, product_url, campaign_goal, direction, pivot_notes, platform, due_date, publish_date, assignee, req.user!.id]
      );

      await logAudit({
        entityType: 'content_item',
        entityId: id,
        action: 'create',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { brand, platform, status: 'idea' },
      });

      const result = await query('SELECT * FROM content_items WHERE id = $1', [id]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Error creating item:', err);
      res.status(500).json({ error: 'Failed to create item' });
    }
  }
);

router.put(
  '/items/:id',
  [
    param('id').isUUID(),
    body('brand').optional().trim(),
    body('platform').optional().trim(),
    body('product_url').optional().trim(),
    body('campaign_goal').optional().trim(),
    body('direction').optional().trim(),
    body('pivot_notes').optional().trim(),
    body('due_date').optional({ nullable: true }),
    body('publish_date').optional({ nullable: true }),
    body('assignee').optional({ nullable: true }).trim(),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const existing = await query('SELECT * FROM content_items WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const fields = ['brand', 'product_url', 'campaign_goal', 'direction', 'pivot_notes', 'platform', 'due_date', 'publish_date', 'assignee'];
      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = $${idx++}`);
          values.push(req.body[field]);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = NOW()`);
      values.push(req.params.id);

      await query(
        `UPDATE content_items SET ${updates.join(', ')} WHERE id = $${idx}`,
        values
      );

      await logAudit({
        entityType: 'content_item',
        entityId: req.params.id,
        action: 'update',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { updated_fields: Object.keys(req.body).filter(k => fields.includes(k)) },
      });

      const result = await query('SELECT * FROM content_items WHERE id = $1', [req.params.id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Error updating item:', err);
      res.status(500).json({ error: 'Failed to update item' });
    }
  }
);

router.delete('/items/:id', [param('id').isUUID()], requireRole('admin'), async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const existing = await query('SELECT * FROM content_items WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    await query('DELETE FROM content_items WHERE id = $1', [req.params.id]);
    await logAudit({
      entityType: 'content_item',
      entityId: req.params.id,
      action: 'delete',
      actor: req.user!.id,
      actorRole: req.user!.role,
      details: { brand: existing.rows[0].brand },
    });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

router.post(
  '/items/:id/transition',
  [
    param('id').isUUID(),
    body('to').isIn(getAllStatuses()),
    body('reason').optional().trim(),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const existing = await query('SELECT * FROM content_items WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const item = existing.rows[0];
      const fromStatus: ContentStatus = item.status;
      const toStatus: ContentStatus = req.body.to;

      if (!canTransition(fromStatus, toStatus, req.user!.role)) {
        const valid = getValidTransitions(fromStatus, req.user!.role);
        return res.status(422).json({
          error: `Cannot transition from '${fromStatus}' to '${toStatus}'`,
          valid_transitions: valid,
        });
      }

      await query(
        'UPDATE content_items SET status = $1, updated_at = NOW() WHERE id = $2',
        [toStatus, req.params.id]
      );

      await logAudit({
        entityType: 'content_item',
        entityId: req.params.id,
        action: 'transition',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { from: fromStatus, to: toStatus, reason: req.body.reason || '' },
      });

      const result = await query('SELECT * FROM content_items WHERE id = $1', [req.params.id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Error transitioning item:', err);
      res.status(500).json({ error: 'Failed to transition item' });
    }
  }
);

router.get('/items/:id/history', [param('id').isUUID()], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const history = await getAuditLog('content_item', req.params.id);
    res.json({ history });
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const statusCounts = await query(
      `SELECT status, COUNT(*)::int as count FROM content_items GROUP BY status`
    );
    const dueSoon = await query(
      `SELECT COUNT(*)::int as count FROM content_items WHERE due_date BETWEEN NOW() AND NOW() + INTERVAL '3 days' AND status NOT IN ('published')`
    );
    const scheduledToday = await query(
      `SELECT COUNT(*)::int as count FROM content_items WHERE publish_date::date = CURRENT_DATE AND status = 'scheduled'`
    );
    const total = await query(`SELECT COUNT(*)::int as count FROM content_items`);

    const byStatus: Record<string, number> = {};
    for (const row of statusCounts.rows) {
      byStatus[row.status] = row.count;
    }

    res.json({
      total: total.rows[0].count,
      by_status: byStatus,
      due_soon: dueSoon.rows[0].count,
      scheduled_today: scheduledToday.rows[0].count,
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;

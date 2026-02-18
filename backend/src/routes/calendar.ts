import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { logAudit } from '../services/audit';

const router = Router();

router.get('/calendar', async (req: Request, res: Response) => {
  try {
    const { start, end, platform, status, assignee, brand } = req.query;

    let sql = `SELECT * FROM content_items WHERE (publish_date IS NOT NULL OR due_date IS NOT NULL)`;
    const params: unknown[] = [];
    let idx = 1;

    if (start) {
      sql += ` AND (publish_date >= $${idx} OR due_date >= $${idx})`;
      params.push(start);
      idx++;
    }
    if (end) {
      sql += ` AND (publish_date <= $${idx} OR due_date <= $${idx})`;
      params.push(end);
      idx++;
    }
    if (platform) {
      sql += ` AND platform = $${idx++}`;
      params.push(platform);
    }
    if (status) {
      sql += ` AND status = $${idx++}`;
      params.push(status);
    }
    if (assignee) {
      sql += ` AND assignee = $${idx++}`;
      params.push(assignee);
    }
    if (brand) {
      sql += ` AND brand ILIKE $${idx++}`;
      params.push(`%${brand}%`);
    }

    sql += ' ORDER BY COALESCE(publish_date, due_date) ASC';
    const result = await query(sql, params);
    res.json({ items: result.rows });
  } catch (err) {
    console.error('Error fetching calendar items:', err);
    res.status(500).json({ error: 'Failed to fetch calendar items' });
  }
});

router.put('/calendar/:id/reschedule', async (req: Request, res: Response) => {
  try {
    const { publish_date, due_date } = req.body;
    const existing = await query('SELECT * FROM content_items WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (publish_date !== undefined) {
      updates.push(`publish_date = $${idx++}`);
      values.push(publish_date);
    }
    if (due_date !== undefined) {
      updates.push(`due_date = $${idx++}`);
      values.push(due_date);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No date fields provided' });
    }

    updates.push('updated_at = NOW()');
    values.push(req.params.id);

    await query(
      `UPDATE content_items SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );

    await logAudit({
      entityType: 'content_item',
      entityId: req.params.id,
      action: 'reschedule',
      actor: req.user?.id || 'unknown',
      actorRole: (req.user?.role as 'staff' | 'manager' | 'admin') || 'staff',
      details: {
        publish_date: publish_date ?? null,
        due_date: due_date ?? null,
      },
    });

    const result = await query('SELECT * FROM content_items WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error rescheduling item:', err);
    res.status(500).json({ error: 'Failed to reschedule item' });
  }
});

export default router;

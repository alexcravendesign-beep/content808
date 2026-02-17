import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { body, param, validationResult } from 'express-validator';
import { logAudit } from '../services/audit';
import { requireRole } from '../middleware/auth';

const router = Router();

router.get('/approvals', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM content_items WHERE status = 'review' ORDER BY updated_at ASC`
    );
    res.json({ items: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('Error fetching approvals:', err);
    res.status(500).json({ error: 'Failed to fetch approvals queue' });
  }
});

router.post(
  '/approvals/:id/approve',
  [param('id').isUUID()],
  requireRole('manager', 'admin'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const existing = await query('SELECT * FROM content_items WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }
      if (existing.rows[0].status !== 'review') {
        return res.status(422).json({ error: 'Item is not in review status' });
      }

      await query(
        `UPDATE content_items SET status = 'approved', updated_at = NOW() WHERE id = $1`,
        [req.params.id]
      );

      await logAudit({
        entityType: 'content_item',
        entityId: req.params.id,
        action: 'approve',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { from: 'review', to: 'approved' },
      });

      const result = await query('SELECT * FROM content_items WHERE id = $1', [req.params.id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Error approving item:', err);
      res.status(500).json({ error: 'Failed to approve item' });
    }
  }
);

router.post(
  '/approvals/:id/block',
  [
    param('id').isUUID(),
    body('reason').notEmpty().trim(),
  ],
  requireRole('manager', 'admin'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const existing = await query('SELECT * FROM content_items WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }
      if (existing.rows[0].status !== 'review') {
        return res.status(422).json({ error: 'Item is not in review status' });
      }

      await query(
        `UPDATE content_items SET status = 'blocked', updated_at = NOW() WHERE id = $1`,
        [req.params.id]
      );

      await logAudit({
        entityType: 'content_item',
        entityId: req.params.id,
        action: 'block',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { from: 'review', to: 'blocked', reason: req.body.reason },
      });

      const result = await query('SELECT * FROM content_items WHERE id = $1', [req.params.id]);
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Error blocking item:', err);
      res.status(500).json({ error: 'Failed to block item' });
    }
  }
);

export default router;

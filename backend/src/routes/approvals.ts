import { Router, Request, Response } from 'express';
import { supabase } from '../db/connection';
import { body, param, validationResult } from 'express-validator';
import { logAudit } from '../services/audit';
import { requireRole } from '../middleware/auth';

const router = Router();

router.get('/approvals', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('content_items')
      .select('*')
      .eq('status', 'review')
      .order('updated_at', { ascending: true });
    if (error) throw new Error(error.message);
    res.json({ items: data || [], total: (data || []).length });
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
      const { data: existing, error: fetchError } = await supabase
        .from('content_items')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();
      if (fetchError) throw new Error(fetchError.message);
      if (!existing) {
        return res.status(404).json({ error: 'Item not found' });
      }
      if (existing.status !== 'review') {
        return res.status(422).json({ error: 'Item is not in review status' });
      }

      const { error: updateError } = await supabase
        .from('content_items')
        .update({ status: 'approved' })
        .eq('id', req.params.id);
      if (updateError) throw new Error(updateError.message);

      await logAudit({
        entityType: 'content_item',
        entityId: req.params.id,
        action: 'approve',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { from: 'review', to: 'approved' },
      });

      const { data } = await supabase.from('content_items').select('*').eq('id', req.params.id).single();
      res.json(data);
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
      const { data: existing, error: fetchError } = await supabase
        .from('content_items')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();
      if (fetchError) throw new Error(fetchError.message);
      if (!existing) {
        return res.status(404).json({ error: 'Item not found' });
      }
      if (existing.status !== 'review') {
        return res.status(422).json({ error: 'Item is not in review status' });
      }

      const { error: updateError } = await supabase
        .from('content_items')
        .update({ status: 'blocked' })
        .eq('id', req.params.id);
      if (updateError) throw new Error(updateError.message);

      await logAudit({
        entityType: 'content_item',
        entityId: req.params.id,
        action: 'block',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { from: 'review', to: 'blocked', reason: req.body.reason },
      });

      const { data } = await supabase.from('content_items').select('*').eq('id', req.params.id).single();
      res.json(data);
    } catch (err) {
      console.error('Error blocking item:', err);
      res.status(500).json({ error: 'Failed to block item' });
    }
  }
);

export default router;

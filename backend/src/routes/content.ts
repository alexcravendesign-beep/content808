import { Router, Request, Response } from 'express';
import { supabase } from '../db/connection';
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
    const { status, platform, assignee, brand, search, limit, offset } = req.query;

    // Build a count query
    let countQuery = supabase.from('content_items').select('*', { count: 'exact', head: true });
    // Build a data query
    let dataQuery = supabase.from('content_items').select('*');

    if (status) {
      countQuery = countQuery.eq('status', String(status));
      dataQuery = dataQuery.eq('status', String(status));
    }
    if (platform) {
      countQuery = countQuery.eq('platform', String(platform));
      dataQuery = dataQuery.eq('platform', String(platform));
    }
    if (assignee) {
      countQuery = countQuery.eq('assignee', String(assignee));
      dataQuery = dataQuery.eq('assignee', String(assignee));
    }
    if (brand) {
      countQuery = countQuery.ilike('brand', `%${brand}%`);
      dataQuery = dataQuery.ilike('brand', `%${brand}%`);
    }
    if (search) {
      const pattern = `%${search}%`;
      // campaign_goal and direction are now JSONB — cast to text for search
      countQuery = countQuery.or(`brand.ilike.${pattern},campaign_goal::text.ilike.${pattern},direction::text.ilike.${pattern}`);
      dataQuery = dataQuery.or(`brand.ilike.${pattern},campaign_goal::text.ilike.${pattern},direction::text.ilike.${pattern}`);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw new Error(countError.message);
    const total = count || 0;

    const pageLimit = Math.min(parseInt(limit as string) || 200, 500);
    const pageOffset = parseInt(offset as string) || 0;

    dataQuery = dataQuery
      .order('updated_at', { ascending: false })
      .range(pageOffset, pageOffset + pageLimit - 1);

    const { data, error } = await dataQuery;
    if (error) throw new Error(error.message);

    res.json({ items: data || [], total, limit: pageLimit, offset: pageOffset });
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

router.get('/items/:id', [param('id').isUUID()], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const { data, error } = await supabase
      .from('content_items')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const validTransitions = req.user
      ? getValidTransitions(data.status, req.user.role)
      : [];
    res.json({ ...data, valid_transitions: validTransitions });
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
    body('product_title').optional().trim(),
    body('product_image_url').optional().trim(),
    body('campaign_goal').optional(),
    body('direction').optional(),
    body('target_audience').optional(),
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
        brand, product_url = '', product_title = '', product_image_url = '',
        product_id = null, campaign_goal = null, direction = null,
        target_audience = null,
        pivot_notes = '', platform = '', due_date = null,
        publish_date = null, assignee = null
      } = req.body;

      const { error: insertError } = await supabase.from('content_items').insert({
        id,
        brand,
        product_url,
        product_title,
        product_image_url,
        product_id,
        campaign_goal,
        direction,
        target_audience,
        pivot_notes,
        platform,
        status: 'idea',
        due_date,
        publish_date,
        assignee,
        created_by: req.user!.id,
      });
      if (insertError) throw new Error(insertError.message);

      await logAudit({
        entityType: 'content_item',
        entityId: id,
        action: 'create',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { brand, platform, status: 'idea' },
      });

      const { data } = await supabase.from('content_items').select('*').eq('id', id).single();
      res.status(201).json(data);
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
    body('product_title').optional().trim(),
    body('product_image_url').optional().trim(),
    body('campaign_goal').optional(),
    body('direction').optional(),
    body('target_audience').optional(),
    body('pivot_notes').optional().trim(),
    body('due_date').optional({ nullable: true }),
    body('publish_date').optional({ nullable: true }),
    body('assignee').optional({ nullable: true }).trim(),
  ],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
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

      const fields = ['brand', 'product_url', 'product_title', 'product_image_url', 'product_id', 'campaign_goal', 'direction', 'target_audience', 'pivot_notes', 'platform', 'due_date', 'publish_date', 'assignee'];
      const updateObj: Record<string, unknown> = {};

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          updateObj[field] = req.body[field];
        }
      }

      if (Object.keys(updateObj).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const { error: updateError } = await supabase
        .from('content_items')
        .update(updateObj)
        .eq('id', req.params.id);
      if (updateError) throw new Error(updateError.message);

      await logAudit({
        entityType: 'content_item',
        entityId: req.params.id,
        action: 'update',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { updated_fields: Object.keys(req.body).filter(k => fields.includes(k)) },
      });

      const { data } = await supabase.from('content_items').select('*').eq('id', req.params.id).single();
      res.json(data);
    } catch (err) {
      console.error('Error updating item:', err);
      res.status(500).json({ error: 'Failed to update item' });
    }
  }
);

router.delete('/items/:id', [param('id').isUUID()], requireRole('admin'), async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
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

    const { error: deleteError } = await supabase.from('content_items').delete().eq('id', req.params.id);
    if (deleteError) throw new Error(deleteError.message);

    await logAudit({
      entityType: 'content_item',
      entityId: req.params.id,
      action: 'delete',
      actor: req.user!.id,
      actorRole: req.user!.role,
      details: { brand: existing.brand },
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
      const { data: existing, error: fetchError } = await supabase
        .from('content_items')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();
      if (fetchError) throw new Error(fetchError.message);
      if (!existing) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const fromStatus: ContentStatus = existing.status;
      const toStatus: ContentStatus = req.body.to;

      if (!canTransition(fromStatus, toStatus, req.user!.role)) {
        const valid = getValidTransitions(fromStatus, req.user!.role);
        return res.status(422).json({
          error: `Cannot transition from '${fromStatus}' to '${toStatus}'`,
          valid_transitions: valid,
        });
      }

      const { error: updateError } = await supabase
        .from('content_items')
        .update({ status: toStatus })
        .eq('id', req.params.id);
      if (updateError) throw new Error(updateError.message);

      await logAudit({
        entityType: 'content_item',
        entityId: req.params.id,
        action: 'transition',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { from: fromStatus, to: toStatus, reason: req.body.reason || '' },
      });

      const { data } = await supabase.from('content_items').select('*').eq('id', req.params.id).single();
      res.json(data);
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
    // Fetch all content items status for grouping
    const { data: items, error: itemsError } = await supabase
      .from('content_items')
      .select('status, due_date, publish_date');
    if (itemsError) throw new Error(itemsError.message);

    const allItems = items || [];
    const total = allItems.length;

    const byStatus: Record<string, number> = {};
    for (const row of allItems) {
      byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    }

    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];

    let dueSoon = 0;
    let scheduledToday = 0;
    for (const row of allItems) {
      if (row.due_date && row.status !== 'published') {
        const d = new Date(row.due_date);
        if (d >= now && d <= threeDaysLater) dueSoon++;
      }
      if (row.publish_date && row.status === 'scheduled') {
        const pDate = new Date(row.publish_date).toISOString().split('T')[0];
        if (pDate === todayStr) scheduledToday++;
      }
    }

    res.json({
      total,
      by_status: byStatus,
      due_soon: dueSoon,
      scheduled_today: scheduledToday,
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── Agent Fill ──
router.post(
  '/items/:id/agent-fill',
  [param('id').isUUID()],
  async (req: Request, res: Response) => {
    if (!handleValidation(req, res)) return;
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('content_items')
        .select('id')
        .eq('id', req.params.id)
        .maybeSingle();
      if (fetchError) throw new Error(fetchError.message);
      if (!existing) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const { Queue } = await import('bullmq');
      const { redisConnection } = await import('../db/redis');
      const agentQueue = new Queue('agent-fill', { connection: redisConnection });
      await agentQueue.add('fill', { itemId: req.params.id });

      res.status(202).json({ message: 'Agent fill job queued', itemId: req.params.id });
    } catch (err) {
      console.error('Error queuing agent fill:', err);
      res.status(500).json({ error: 'Failed to queue agent fill' });
    }
  }
);

export default router;

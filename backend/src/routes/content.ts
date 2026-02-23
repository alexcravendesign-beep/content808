import { Router, Request, Response } from 'express';
import { supabase } from '../db/connection';
import { body, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { logAudit, getAuditLog } from '../services/audit';
import { canTransition, getValidTransitions, getAllStatuses } from '../services/transitions';
import { requireRole } from '../middleware/auth';
import { ContentStatus, UserRole } from '../types';

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
      // campaign_goal and direction may be TEXT (pre-migration) or JSONB (post-migration)
      // ilike works on both types; ::text cast is only needed for JSONB but breaks on TEXT
      countQuery = countQuery.or(`brand.ilike.${pattern},campaign_goal.ilike.${pattern},direction.ilike.${pattern}`);
      dataQuery = dataQuery.or(`brand.ilike.${pattern},campaign_goal.ilike.${pattern},direction.ilike.${pattern}`);
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
        product_id, campaign_goal = null, direction = null,
        target_audience,
        pivot_notes = '', platform = '', due_date = null,
        publish_date = null, assignee = null
      } = req.body;

      // Ensure JSON fields are stored as proper JSON strings when the
      // underlying column is still TEXT (pre-migration 005).  If the column
      // has already been converted to JSONB the string will still be valid.
      const safeJsonField = (v: unknown): string | null => {
        if (v === null || v === undefined) return null;
        if (typeof v === 'string') return v;
        return JSON.stringify(v);
      };

      // Base insert object (columns that always exist)
      const baseInsert: Record<string, unknown> = {
        id,
        brand,
        product_url,
        product_title,
        product_image_url,
        campaign_goal: safeJsonField(campaign_goal),
        direction: safeJsonField(direction),
        pivot_notes,
        platform,
        status: 'idea',
        due_date,
        publish_date,
        assignee,
        created_by: req.user!.id,
      };

      // Try inserting with migration-dependent columns first; if the schema
      // hasn't been migrated yet (columns don't exist), retry without them.
      const fullInsert: Record<string, unknown> = { ...baseInsert };
      if (product_id !== undefined) fullInsert.product_id = product_id;
      if (target_audience !== undefined) fullInsert.target_audience = target_audience;

      let { error: insertError } = await supabase.from('content_items').insert(fullInsert);
      if (insertError?.message?.includes('column') && insertError.message.includes('schema cache')) {
        // Migration 005 hasn't been applied yet — retry without new columns
        ({ error: insertError } = await supabase.from('content_items').insert(baseInsert));
      }
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

      // Base fields that always exist; migration-dependent fields (product_id,
      // target_audience) are only included when the caller sends them so the
      // update works both before and after migration 005.
      const baseFields = ['brand', 'product_url', 'product_title', 'product_image_url', 'campaign_goal', 'direction', 'pivot_notes', 'platform', 'due_date', 'publish_date', 'assignee'];
      const migrationFields = ['product_id', 'target_audience'];
      const updateObj: Record<string, unknown> = {};

      // Fields that must be JSON-stringified for TEXT columns (pre-migration)
      const jsonFields = ['campaign_goal', 'direction'];
      const safeJsonField = (v: unknown): string | null => {
        if (v === null || v === undefined) return null;
        if (typeof v === 'string') return v;
        return JSON.stringify(v);
      };

      for (const field of baseFields) {
        if (req.body[field] !== undefined) {
          updateObj[field] = jsonFields.includes(field)
            ? safeJsonField(req.body[field])
            : req.body[field];
        }
      }
      const migrationObj: Record<string, unknown> = {};
      for (const field of migrationFields) {
        if (req.body[field] !== undefined) {
          migrationObj[field] = req.body[field];
        }
      }

      const fullUpdateObj = { ...updateObj, ...migrationObj };
      if (Object.keys(fullUpdateObj).length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      // Try with migration-dependent columns; if schema hasn't been
      // migrated yet, retry without them.
      let { error: updateError } = await supabase
        .from('content_items')
        .update(fullUpdateObj)
        .eq('id', req.params.id);
      if (updateError?.message?.includes('column') && updateError.message.includes('schema cache')) {
        if (Object.keys(updateObj).length === 0) {
          return res.status(400).json({ error: 'No fields to update (migration pending)' });
        }
        ({ error: updateError } = await supabase
          .from('content_items')
          .update(updateObj)
          .eq('id', req.params.id));
      }
      if (updateError) throw new Error(updateError.message);

      await logAudit({
        entityType: 'content_item',
        entityId: req.params.id,
        action: 'update',
        actor: req.user!.id,
        actorRole: req.user!.role,
        details: { updated_fields: Object.keys(req.body).filter(k => [...baseFields, ...migrationFields].includes(k)) },
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
async function syncAssetsForItem(itemId: string, actorId: string, actorRole: UserRole = 'admin') {
  const { data: item, error: itemErr } = await supabase
    .from('content_items')
    .select('*')
    .eq('id', itemId)
    .maybeSingle();
  if (itemErr) throw new Error(itemErr.message);
  if (!item) return { ok: false, error: 'Item not found', created: 0 };
  if (!item.product_title) return { ok: false, error: 'Item has no product_title', created: 0 };

  const { data: products, error: productErr } = await supabase
    .from('products')
    .select('id,name,images,infographic_url,infographic_prompt')
    .ilike('name', `%${item.product_title}%`)
    .limit(1);
  if (productErr) throw new Error(productErr.message);
  const product = products?.[0];
  if (!product) return { ok: false, error: 'No matching product found', created: 0 };

  const outputsToCreate: Array<{ output_type: string; output_data: Record<string, unknown> }> = [];
  if (product.infographic_url) {
    outputsToCreate.push({
      output_type: 'infographic_image',
      output_data: {
        url: product.infographic_url,
        prompt: product.infographic_prompt || null,
        product_name: product.name,
      },
    });
  }

  const firstImage = Array.isArray(product.images) && product.images.length ? product.images[0] : null;
  if (firstImage) {
    outputsToCreate.push({
      output_type: 'product_image',
      output_data: {
        url: firstImage,
        product_name: product.name,
      },
    });
  }

  for (const out of outputsToCreate) {
    await supabase.from('content_item_outputs').insert({
      id: uuidv4(),
      content_item_id: item.id,
      output_type: out.output_type,
      output_data: out.output_data,
    });
  }

  await logAudit({
    entityType: 'content_item',
    entityId: item.id,
    action: 'update',
    actor: actorId,
    actorRole,
    details: { synced_outputs: outputsToCreate.map(o => o.output_type), product_name: product.name },
  });

  return { ok: true, created: outputsToCreate.length, product_name: product.name };
}

router.post('/items/:id/sync-product-assets', [param('id').isUUID()], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const result = await syncAssetsForItem(req.params.id, req.user!.id, req.user!.role);
    if (!result.ok) return res.status(404).json(result);
    res.json(result);
  } catch (err) {
    console.error('Error syncing product assets:', err);
    res.status(500).json({ error: 'Failed to sync product assets' });
  }
});

router.post('/items/sync-product-assets-batch', [body('item_ids').isArray({ min: 1 })], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const ids = (req.body.item_ids as string[]).slice(0, 200);
    const results = [] as Array<{ item_id: string; ok: boolean; created: number; error?: string; product_name?: string }>;

    for (const id of ids) {
      try {
        const r = await syncAssetsForItem(id, req.user!.id, req.user!.role);
        results.push({ item_id: id, ...r });
      } catch (e) {
        results.push({ item_id: id, ok: false, created: 0, error: e instanceof Error ? e.message : 'unknown_error' });
      }
    }

    const okCount = results.filter(r => r.ok).length;
    const createdTotal = results.reduce((n, r) => n + (r.created || 0), 0);
    res.json({ ok: true, processed: results.length, okCount, createdTotal, results });
  } catch (err) {
    console.error('Error batch syncing product assets:', err);
    res.status(500).json({ error: 'Failed to batch sync product assets' });
  }
});

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

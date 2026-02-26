import { Router, Request, Response } from 'express';
import { Buffer } from 'node:buffer';
import multer from 'multer';
import { supabase } from '../db/connection';
import { body, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../db/redis';
import { logAudit, getAuditLog } from '../services/audit';
import { canTransition, getValidTransitions, getAllStatuses } from '../services/transitions';
import { checkAutoTransition } from '../services/auto-status';
import { requireRole } from '../middleware/auth';
import { ContentStatus, UserRole } from '../types';

const router = Router();

const generateBatchQueue = new Queue('generate-batch', { connection: redisConnection });
let generateBatchWorkerStarted = false;

type GenerateMode = 'infographic' | 'hero' | 'both';
interface GenerateBatchJobData { itemIds: string[]; mode: GenerateMode; actorId: string; actorRole: string; }

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
      const searchOr = [
        `brand.ilike.${pattern}`,
        `product_title.ilike.${pattern}`,
        `pivot_notes.ilike.${pattern}`,
        `final_copy.ilike.${pattern}`,
      ].join(',');
      countQuery = countQuery.or(searchOr);
      dataQuery = dataQuery.or(searchOr);
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

    const items = data || [];
    const ids = items.map((i: any) => i.id).filter(Boolean);
    let flagsById: Record<string, { has_hero: boolean; has_infographic: boolean; creative_done: boolean; has_facebook_approved: boolean; approved_facebook_posts: number }> = {};

    if (ids.length) {
      const { data: outputs, error: outErr } = await supabase
        .from('content_item_outputs')
        .select('content_item_id,output_type,output_data,created_at')
        .in('content_item_id', ids)
        .in('output_type', ['hero_image', 'infographic_image'])
        .order('created_at', { ascending: false });
      if (outErr) throw new Error(outErr.message);

      for (const id of ids) flagsById[id] = { has_hero: false, has_infographic: false, creative_done: false, has_facebook_approved: false, approved_facebook_posts: 0 };

      for (const o of outputs || []) {
        const id = (o as any).content_item_id as string;
        if (!flagsById[id]) flagsById[id] = { has_hero: false, has_infographic: false, creative_done: false, has_facebook_approved: false, approved_facebook_posts: 0 };
        const status = (o as any).output_data?.status || 'completed';
        if (status !== 'completed') continue;
        if ((o as any).output_type === 'hero_image') flagsById[id].has_hero = true;
        if ((o as any).output_type === 'infographic_image') flagsById[id].has_infographic = true;
      }

      const itemToProduct = new Map<string, string>();
      for (const it of items) {
        if ((it as any).id && (it as any).product_id) itemToProduct.set((it as any).id, (it as any).product_id);
      }

      // Backward-compat: older DBs may not have content_items.product_id yet.
      // Fallback map by exact product_title -> products.name (case-insensitive).
      const missingItems = (items as any[]).filter((it) => it?.id && !itemToProduct.has(it.id) && it?.product_title);
      if (missingItems.length) {
        const titles = Array.from(new Set(missingItems.map((it) => String(it.product_title).trim()).filter(Boolean)));
        if (titles.length) {
          const { data: productRows, error: productErr } = await supabase
            .from('products')
            .select('id,name')
            .in('name', titles);
          if (!productErr) {
            const byName = new Map<string, string>();
            for (const p of productRows || []) byName.set(String((p as any).name).toLowerCase(), String((p as any).id));
            for (const it of missingItems) {
              const pid = byName.get(String(it.product_title || '').toLowerCase());
              if (pid) itemToProduct.set(it.id, pid);
            }
          }
        }
      }

      const productIds = Array.from(new Set(Array.from(itemToProduct.values())));
      if (productIds.length) {
        const { data: fbRows, error: fbErr } = await supabase
          .from('mock_facebook_posts')
          .select('product_id')
          .in('product_id', productIds)
          .eq('approval_status', 'approved');
        if (fbErr) throw new Error(fbErr.message);

        const approvedByProduct = new Map<string, number>();
        for (const row of fbRows || []) {
          const pid = (row as any).product_id as string;
          approvedByProduct.set(pid, (approvedByProduct.get(pid) || 0) + 1);
        }

        for (const [itemId, productId] of itemToProduct.entries()) {
          const c = approvedByProduct.get(productId) || 0;
          if (!flagsById[itemId]) flagsById[itemId] = { has_hero: false, has_infographic: false, creative_done: false, has_facebook_approved: false, approved_facebook_posts: 0 };
          flagsById[itemId].approved_facebook_posts = c;
          flagsById[itemId].has_facebook_approved = c > 0;
        }
      }

      for (const id of Object.keys(flagsById)) {
        flagsById[id].creative_done = flagsById[id].has_hero && flagsById[id].has_infographic;
      }
    }

    const enriched = items.map((i: any) => ({ ...i, ...(flagsById[i.id] || { has_hero: false, has_infographic: false, creative_done: false, has_facebook_approved: false, approved_facebook_posts: 0 }) }));

    res.json({ items: enriched, total, limit: pageLimit, offset: pageOffset });
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
        url: normalizePublicUrl(product.infographic_url),
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
        url: normalizePublicUrl(firstImage),
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

  // Auto-transition after syncing assets
  if (outputsToCreate.length > 0) {
    await checkAutoTransition(item.id);
  }

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

function norm(s: string) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function scoreTitleMatch(itemTitle: string, productName: string) {
  const a = norm(itemTitle);
  const b = norm(productName);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (b.includes(a)) return 90;
  if (a.includes(b)) return 80;

  const aTokens = new Set(a.split(' ').filter(Boolean));
  const bTokens = new Set(b.split(' ').filter(Boolean));
  let overlap = 0;
  for (const t of aTokens) if (bTokens.has(t)) overlap++;
  const denom = Math.max(aTokens.size, 1);
  return Math.round((overlap / denom) * 70);
}

async function getItemAndProduct(itemId: string) {
  const { data: item, error: itemErr } = await supabase
    .from('content_items')
    .select('*')
    .eq('id', itemId)
    .maybeSingle();
  if (itemErr) throw new Error(itemErr.message);
  if (!item) throw new Error('Item not found');

  const productTitle = String(item.product_title || '').trim();
  if (!productTitle) throw new Error('Item has no product_title');

  // Pull candidate set by title only (brand fallback caused wrong product reuse)
  const { data: products, error: productErr } = await supabase
    .from('products')
    .select('id,name,brand,category,description,features,technical_specs,benefits,images,infographic_url,infographic_prompt')
    .ilike('name', `%${productTitle}%`)
    .limit(25);
  if (productErr) throw new Error(productErr.message);

  let candidates = products || [];

  // If nothing title-matched, do a wider pull and rank by similarity
  if (!candidates.length) {
    const { data: wide, error: wideErr } = await supabase
      .from('products')
      .select('id,name,brand,category,description,features,technical_specs,benefits,images,infographic_url,infographic_prompt')
      .limit(200);
    if (wideErr) throw new Error(wideErr.message);
    candidates = (wide || [])
      .map((p) => ({ ...p, _score: scoreTitleMatch(productTitle, String(p.name || '')) }))
      .filter((p: any) => p._score >= 35)
      .sort((x: any, y: any) => y._score - x._score)
      .slice(0, 25) as any;
  }

  if (!candidates.length) throw new Error(`No matching product found for title: ${productTitle}`);

  const ranked = candidates
    .map((p: any) => ({ ...p, _score: scoreTitleMatch(productTitle, String(p.name || '')) }))
    .sort((x: any, y: any) => y._score - x._score);

  const product = ranked[0] as any;
  if (!product) throw new Error('No matching product found');

  return { item, product };
}

function normalizePublicUrl(url: string) {
  return String(url)
    .replace('http://localhost:8000', 'https://supabase.cravencooling.services')
    .replace('http://host.docker.internal:8000', 'https://supabase.cravencooling.services');
}

function asLines(v: unknown, take = 6): string {
  if (Array.isArray(v)) return v.filter(Boolean).slice(0, take).join('\n');
  if (typeof v === 'string') return v;
  return '';
}

function buildInfographicPrompt(product: Record<string, unknown>) {
  const template = `Create a professional product infographic design featuring:

PRODUCT INFORMATION:
- Name: {{NAME}}
- Category: {{CATEGORY}}
- Description: {{DESCRIPTION}}

KEY FEATURES:
{{FEATURES}}

TECHNICAL SPECIFICATIONS:
{{SPECS}}

BENEFITS:
{{BENEFITS}}

BRAND IDENTITY:
- Visual Style: Modern and Professional
- Brand Colors: {{BRAND_COLORS}}
- Brand Values: Quality, Innovation, Trust
- Logo: Include the provided logo image in the top-left corner

DESIGN REQUIREMENTS:
- Create a clean, modern infographic layout with clear visual hierarchy
- Use the brand colors prominently throughout the design
- Include data visualization elements (icons, charts, comparison graphics)
- Organize information in digestible sections with clear headings
- Professional business presentation aesthetic
- Include visual representations of key specifications
- Use iconography to represent features and benefits
- Maintain whitespace for readability
- Typography should be bold and legible
- NO product photography - focus on data visualization and typography
- Aspect ratio: Portrait 9:16 (1080x1920)

OUTPUT STYLE: Modern corporate infographic, flat design aesthetic, professional marketing material quality, suitable for presentations and social media.`;

  return template
    .replace('{{NAME}}', String(product.name || 'Unknown Product'))
    .replace('{{CATEGORY}}', String(product.category || 'Commercial Refrigeration'))
    .replace('{{DESCRIPTION}}', String(product.description || 'Professional commercial product for demanding environments.'))
    .replace('{{FEATURES}}', asLines(product.features, 6) || 'Professional build\nReliable operation\nCommercial grade components')
    .replace('{{SPECS}}', asLines(product.technical_specs, 6) || 'See product specification sheet')
    .replace('{{BENEFITS}}', asLines(product.benefits, 5) || 'Quality | Reliability | Performance')
    .replace('{{BRAND_COLORS}}', 'Blue (#005F87), Teal (#00B7C6)');
}

function parsePriceToNumber(raw: unknown): number | null {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildFinanceCopy(price: number | null): string | null {
  if (!price || price <= 1000) return null;
  return 'Finance available over £1,000: £39.42/month • £6.67/week • Total cost £1,383.12';
}

function buildHeroPrompt(productName: string) {
  return `Create a premium Fridgesmart product hero image for social story format (1080x1920, 9:16).

Use the first image as the locked Fridgesmart brand background template.
Use the second image as the product.

Rules:
- Keep the brand template style, colors, and logo area intact.
- Place the product prominently in the lower-middle area with realistic grounding/shadow.
- Add headline text at the bottom center: "${productName}"
- Typography: bold, clean, high contrast, premium retail style.
- Keep layout minimal and modern.
- No clutter, no random icons, no extra badges, no fake UI.
- Do not alter brand identity.
- Output must look like polished campaign creative.`;
}

function buildHeroOfferPrompt(productName: string, productPrice: string, financeCopy: string | null) {
  return `Create a vertical Instagram/Facebook story image (1080x1920 style) for Fridgesmart.

Use the FIRST input image as the exact product photo of ${productName}.
Use the SECOND input image as the official Fridgesmart logo/background reference at the top. Do not redraw the logo.

Style: clean premium commercial refrigeration ad, blue/white branding, bold readable text.
Include text exactly: "${productName}" and "${productPrice}".
${financeCopy ? `Add a finance badge because this item is over £1000. Finance text must read exactly: "${financeCopy}".` : 'No finance box on this one because price is under £1000.'}
Include CTA exactly: "Shop now at fridgesmart.co.uk".

Rules:
- Keep composition premium and uncluttered.
- Keep typography highly legible for story view.
- Do not invent specs, badges, or random UI elements.
- Output must look like polished campaign creative.`;
}

async function createOutput(contentItemId: string, output_type: string, output_data: Record<string, unknown>) {
  const { error } = await supabase.from('content_item_outputs').insert({
    id: uuidv4(),
    content_item_id: contentItemId,
    output_type,
    output_data,
  });
  if (error) throw new Error(error.message);

  // Auto-transition: idea→draft when any output created, draft→review when all creative done
  const status = (output_data?.status as string) || 'completed';
  if (status === 'completed') {
    await checkAutoTransition(contentItemId);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 45000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

async function urlToInlineData(url: string): Promise<{ mimeType: string; data: string }> {
  const res = await fetchWithTimeout(url, {}, 30000);
  if (!res.ok) throw new Error(`Failed to fetch input image: ${url}`);
  const ab = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'image/png';
  return { mimeType: contentType.split(';')[0], data: Buffer.from(ab).toString('base64') };
}

async function generateWithNanoBanana(prompt: string, imageUrls: string[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const model = process.env.NANO_BANANA_MODEL || 'gemini-3-pro-image-preview';
  const parts: any[] = [];
  for (const u of imageUrls.filter(Boolean)) {
    const inline = await urlToInlineData(u);
    parts.push({ inlineData: inline });
  }
  parts.push({ text: prompt });

  const res = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    }),
  }, 60000);

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Nano Banana API error (${res.status}): ${txt.slice(0, 400)}`);
  }

  const json: any = await res.json();
  const outPart = json?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
  if (!outPart?.inlineData?.data) throw new Error('Nano Banana returned no image');

  return Buffer.from(outPart.inlineData.data, 'base64');
}

async function uploadGeneratedImage(path: string, buffer: Buffer) {
  const { error: upErr } = await supabase.storage.from('mock-facebook-images').upload(path, buffer, {
    contentType: 'image/png', upsert: true,
  });
  if (upErr) throw new Error(upErr.message);
  const { data } = supabase.storage.from('mock-facebook-images').getPublicUrl(path);
  return normalizePublicUrl(data.publicUrl);
}

async function generateHeroImage(itemId: string, productName: string, productImageUrl: string) {
  const templateUrl = process.env.HERO_TEMPLATE_URL || 'https://supabase.cravencooling.services/storage/v1/object/public/mock-facebook-images/Logos/Image_202602212113.jpeg';
  const prompt = buildHeroPrompt(productName);
  const image = await generateWithNanoBanana(prompt, [templateUrl, productImageUrl]);
  const url = await uploadGeneratedImage(`heroes/content_item_${itemId}_${Date.now()}.png`, image);
  return { url, prompt, model: process.env.NANO_BANANA_MODEL || 'gemini-3-pro-image-preview' };
}

async function generateHeroOfferImage(itemId: string, productName: string, productImageUrl: string, productPriceRaw: unknown) {
  const templateUrl = process.env.HERO_TEMPLATE_URL || 'https://supabase.cravencooling.services/storage/v1/object/public/mock-facebook-images/Logos/Image_202602212113.jpeg';
  const priceNum = parsePriceToNumber(productPriceRaw);
  const productPrice = priceNum ? `£${priceNum.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Price on request';
  const financeCopy = buildFinanceCopy(priceNum);
  const prompt = buildHeroOfferPrompt(productName, productPrice, financeCopy);
  const image = await generateWithNanoBanana(prompt, [productImageUrl, templateUrl]);
  const url = await uploadGeneratedImage(`heroes/offer_content_item_${itemId}_${Date.now()}.png`, image);
  return { url, prompt, model: process.env.NANO_BANANA_MODEL || 'gemini-3-pro-image-preview', finance_applied: !!financeCopy, price: productPrice };
}

async function generateInfographicImage(itemId: string, product: any) {
  const templateUrl = process.env.INFOGRAPHIC_TEMPLATE_URL || process.env.HERO_TEMPLATE_URL || 'https://supabase.cravencooling.services/storage/v1/object/public/mock-facebook-images/Logos/Image_202602212113.jpeg';
  const prompt = buildInfographicPrompt(product as Record<string, unknown>);
  const image = await generateWithNanoBanana(prompt, [templateUrl]);
  const safe = String(product.name || 'product').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 60);
  const url = await uploadGeneratedImage(`infographics/${safe}_${itemId}_${Date.now()}.png`, image);
  return { url, prompt, model: process.env.NANO_BANANA_MODEL || 'gemini-3-pro-image-preview' };
}

async function processGenerateBatchJob(job: Job<GenerateBatchJobData>) {
  const { itemIds, mode } = job.data;
  const results: Array<{ item_id: string; ok: boolean; error?: string }> = [];

  for (let i = 0; i < itemIds.length; i++) {
    const id = itemIds[i];
    try {
      const { item, product } = await getItemAndProduct(id);

      if (mode === 'infographic' || mode === 'both') {
        const inf = await generateInfographicImage(item.id, product);
        await createOutput(item.id, 'infographic_image', {
          url: inf.url,
          prompt: inf.prompt,
          model: inf.model,
          product_name: product.name,
          mode: 'infographic',
          status: 'completed',
        });
      }

      if (mode === 'hero' || mode === 'both') {
        const img = Array.isArray(product.images) && product.images.length
          ? (product.images.find((u: string) => !/\.webp(\?|$)/i.test(u)) || product.images[0])
          : null;
        if (!img) throw new Error('Product has no source image');
        const hero = await generateHeroImage(item.id, product.name, img);
        await createOutput(item.id, 'hero_image', {
          url: hero.url,
          prompt: hero.prompt,
          model: hero.model,
          product_name: product.name,
          mode: 'hero',
          status: 'completed',
        });
      }

      results.push({ item_id: id, ok: true });
    } catch (e) {
      const error = e instanceof Error ? e.message : 'unknown_error';
      try {
        if (mode === 'hero' || mode === 'both') await createOutput(id, 'hero_image', { mode: 'hero', status: 'failed', error });
        if (mode === 'infographic' || mode === 'both') await createOutput(id, 'infographic_image', { mode: 'infographic', status: 'failed', error });
      } catch {}
      results.push({ item_id: id, ok: false, error });
    }

    await job.updateProgress({ processed: i + 1, total: itemIds.length, okCount: results.filter((r) => r.ok).length });
  }

  return { ok: true, processed: itemIds.length, okCount: results.filter((r) => r.ok).length, results };
}

function ensureGenerateBatchWorker() {
  if (generateBatchWorkerStarted) return;
  const worker = new Worker<GenerateBatchJobData>('generate-batch', processGenerateBatchJob, {
    connection: redisConnection,
    concurrency: 1,
  });
  worker.on('failed', (job, err) => console.error('[generate-batch] failed', job?.id, err.message));
  generateBatchWorkerStarted = true;
}

ensureGenerateBatchWorker();

router.post('/items/:id/generate-infographic', [param('id').isUUID()], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  let itemId = req.params.id;
  let productName = '';
  let prompt = '';
  try {
    const { item, product } = await getItemAndProduct(req.params.id);
    itemId = item.id;
    productName = product.name;

    const out = await generateInfographicImage(item.id, product);
    prompt = out.prompt;

    await createOutput(item.id, 'infographic_image', {
      url: out.url,
      prompt: out.prompt,
      model: out.model,
      product_name: product.name,
      mode: 'infographic',
      status: 'completed',
    });

    return res.json({ ok: true, mode: 'infographic', url: out.url, product_name: product.name, prompt: out.prompt, model: out.model });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'generate-infographic failed';
    try {
      await createOutput(itemId, 'infographic_image', { prompt, product_name: productName, mode: 'infographic', status: 'failed', error });
    } catch {}
    console.error('generate-infographic failed', err);
    return res.status(500).json({ error });
  }
});

router.post('/items/:id/generate-hero', [param('id').isUUID()], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  let itemId = req.params.id;
  let productName = '';
  let prompt = '';
  try {
    const { item, product } = await getItemAndProduct(req.params.id);
    itemId = item.id;
    productName = product.name;
    const productImage = Array.isArray(product.images) && product.images.length
      ? (product.images.find((u: string) => !/\.webp(\?|$)/i.test(u)) || product.images[0])
      : null;
    if (!productImage) return res.status(422).json({ error: 'Product has no source image' });

    const hero = await generateHeroImage(item.id, product.name, productImage);
    prompt = hero.prompt;

    await createOutput(item.id, 'hero_image', {
      url: hero.url,
      prompt: hero.prompt,
      model: hero.model,
      product_name: product.name,
      mode: 'hero',
      status: 'completed',
    });

    return res.json({ ok: true, mode: 'hero', url: hero.url, product_name: product.name, prompt: hero.prompt, model: hero.model });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'generate-hero failed';
    try {
      await createOutput(itemId, 'hero_image', { prompt, product_name: productName, mode: 'hero', status: 'failed', error });
    } catch {}
    console.error('generate-hero failed', err);
    return res.status(500).json({ error });
  }
});

router.post('/items/:id/generate-hero-offer', [param('id').isUUID()], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  let itemId = req.params.id;
  let productName = '';
  let prompt = '';
  try {
    const { item, product } = await getItemAndProduct(req.params.id);
    itemId = item.id;
    productName = product.name;
    const productImage = Array.isArray(product.images) && product.images.length
      ? (product.images.find((u: string) => !/\.webp(\?|$)/i.test(u)) || product.images[0])
      : null;
    if (!productImage) return res.status(422).json({ error: 'Product has no source image' });

    const hero = await generateHeroOfferImage(item.id, product.name, productImage, (product as any).price);
    prompt = hero.prompt;

    await createOutput(item.id, 'hero_image_offer', {
      url: hero.url,
      prompt: hero.prompt,
      model: hero.model,
      product_name: product.name,
      price: hero.price,
      finance_applied: hero.finance_applied,
      mode: 'hero_offer',
      status: 'completed',
    });

    return res.json({ ok: true, mode: 'hero_offer', url: hero.url, product_name: product.name, prompt: hero.prompt, model: hero.model, price: hero.price, finance_applied: hero.finance_applied });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'generate-hero-offer failed';
    try {
      await createOutput(itemId, 'hero_image_offer', { prompt, product_name: productName, mode: 'hero_offer', status: 'failed', error });
    } catch {}
    console.error('generate-hero-offer failed', err);
    return res.status(500).json({ error });
  }
});

router.post('/items/:id/generate-both', [param('id').isUUID()], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const inf = await fetch(`http://localhost:${process.env.PORT || 4000}/api/v1/content-hub/items/${req.params.id}/generate-infographic`, {
      method: 'POST', headers: { 'x-user-id': req.user!.id, 'x-user-name': req.user!.name, 'x-user-role': req.user!.role },
    });
    const hero = await fetch(`http://localhost:${process.env.PORT || 4000}/api/v1/content-hub/items/${req.params.id}/generate-hero`, {
      method: 'POST', headers: { 'x-user-id': req.user!.id, 'x-user-name': req.user!.name, 'x-user-role': req.user!.role },
    });
    return res.json({ ok: inf.ok && hero.ok, infographic: await inf.json(), hero: await hero.json() });
  } catch (err) {
    console.error('generate-both failed', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'generate-both failed' });
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

router.post('/items/generate-batch', [body('item_ids').isArray({ min: 1 }), body('mode').isIn(['infographic', 'hero', 'both'])], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const incomingIds = req.body.item_ids as string[];
    const maxBatch = Number(process.env.CONTENT808_MAX_BATCH_GENERATE || 8);
    if (incomingIds.length > maxBatch) {
      return res.status(422).json({ error: `Batch too large (${incomingIds.length}). Max allowed is ${maxBatch}. Narrow filters/date range and retry.` });
    }

    const job = await generateBatchQueue.add('generate', {
      itemIds: incomingIds.slice(0, maxBatch),
      mode: req.body.mode as GenerateMode,
      actorId: req.user!.id,
      actorRole: req.user!.role,
    }, {
      removeOnComplete: 50,
      removeOnFail: 100,
    });

    return res.status(202).json({ ok: true, queued: true, jobId: job.id });
  } catch (err) {
    console.error('Error queueing generate-batch:', err);
    res.status(500).json({ error: 'Failed to queue generate batch' });
  }
});

router.get('/items/generate-batch/:jobId', [param('jobId').notEmpty()], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const job = await generateBatchQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const state = await job.getState();
    const progress = (job.progress as any) || { processed: 0, total: 0, okCount: 0 };

    if (state === 'completed') {
      const value: any = await job.returnvalue;
      return res.json({ state, ...value, progress });
    }

    if (state === 'failed') {
      return res.json({ state, error: job.failedReason, progress });
    }

    return res.json({ state, progress });
  } catch (err) {
    console.error('Error reading generate-batch job:', err);
    res.status(500).json({ error: 'Failed to read batch job' });
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

// ── Product Outputs Hub ──

// GET /products/:id/outputs — aggregate all outputs across content items linked to a product
router.get('/products/:id/outputs', [param('id').isUUID()], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const productId = req.params.id;

    // Find the product name so we can match content items by title
    const { data: productRow, error: productErr } = await supabase
      .from('products')
      .select('id,name')
      .eq('id', productId)
      .single();
    if (productErr) {
      if (productErr.code === 'PGRST116') {
        return res.status(404).json({ error: 'Product not found' });
      }
      throw new Error(productErr.message);
    }

    // Find content items linked to this product.
    // Try product_id column first; fall back to matching by product_title.
    let itemIds: string[] = [];
    const { data: byPid, error: pidErr } = await supabase
      .from('content_items')
      .select('id')
      .eq('product_id', productId);
    if (!pidErr && byPid && byPid.length > 0) {
      itemIds = byPid.map((i: { id: string }) => i.id);
    } else {
      // Fallback: match by product_title = product name
      const { data: byTitle, error: titleErr } = await supabase
        .from('content_items')
        .select('id')
        .eq('product_title', productRow.name);
      if (titleErr) throw new Error(titleErr.message);
      itemIds = (byTitle || []).map((i: { id: string }) => i.id);
    }

    let outputs: Array<Record<string, unknown>> = [];
    if (itemIds.length) {
      const { data: outputRows, error: outErr } = await supabase
        .from('content_item_outputs')
        .select('*')
        .in('content_item_id', itemIds)
        .order('created_at', { ascending: false });
      if (outErr) throw new Error(outErr.message);
      outputs = outputRows || [];
    }

    // Also fetch product_assets
    const { data: assets, error: assetsErr } = await supabase
      .from('product_assets')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    if (assetsErr && !assetsErr.message.includes('does not exist')) {
      throw new Error(assetsErr.message);
    }

    res.json({ outputs, assets: assets || [] });
  } catch (err) {
    console.error('Error fetching product outputs:', err);
    res.status(500).json({ error: 'Failed to fetch product outputs' });
  }
});

// POST /products/:id/upload-asset — upload file to Supabase storage
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.post('/products/:id/upload-asset', [param('id').isUUID()], upload.single('file'), async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const productId = req.params.id;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const assetId = uuidv4();
    const parts = file.originalname.split('.');
    const ext = parts.length > 1 ? parts.pop()! : 'bin';
    const storagePath = `product-assets/${productId}/${assetId}.${ext}`;

    // Upload to Supabase storage
    const { error: upErr } = await supabase.storage
      .from('mock-facebook-images')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });
    if (upErr) throw new Error(upErr.message);

    const { data: urlData } = supabase.storage
      .from('mock-facebook-images')
      .getPublicUrl(storagePath);
    const publicUrl = normalizePublicUrl(urlData.publicUrl);

    const label = req.body?.label || file.originalname;
    const assetType = req.body?.asset_type || 'manual_upload';

    // Insert into product_assets table
    const { error: insertErr } = await supabase.from('product_assets').insert({
      id: assetId,
      product_id: productId,
      asset_type: assetType,
      url: publicUrl,
      label,
    });
    // If table doesn't exist yet, still return the URL
    if (insertErr && !insertErr.message.includes('does not exist')) {
      throw new Error(insertErr.message);
    }

    res.status(201).json({
      id: assetId,
      product_id: productId,
      asset_type: assetType,
      url: publicUrl,
      label,
    });
  } catch (err) {
    console.error('Error uploading product asset:', err);
    res.status(500).json({ error: 'Failed to upload product asset' });
  }
});

export default router;

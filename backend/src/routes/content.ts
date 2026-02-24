import { Router, Request, Response } from 'express';
import Jimp from 'jimp';
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

function buildHeroPrompt(productName: string) {
  return `Create a branded Fridgesmart story hero image (1080x1920, 9:16). Inputs: First image is the Fridgesmart branded background template. Second image is the product photo/cutout. Rules: Preserve the background and logo exactly. Place product in the lower half, centered horizontally. Keep product large and clear with natural shadow grounding. Add product name text at the bottom center. Product name text must be bold, white, highly legible. Add subtle dark gradient behind bottom text for readability. Keep a clean premium look, no extra icons, no data boxes, no clutter. Do NOT crop the logo area at top. Do NOT alter brand colors. Bottom text: ${productName}`;
}

async function createOutput(contentItemId: string, output_type: string, output_data: Record<string, unknown>) {
  const { error } = await supabase.from('content_item_outputs').insert({
    id: uuidv4(),
    content_item_id: contentItemId,
    output_type,
    output_data,
  });
  if (error) throw new Error(error.message);
}

async function generateHeroImage(itemId: string, productName: string, productImageUrl: string) {
  const templateUrl = process.env.HERO_TEMPLATE_URL || 'https://supabase.cravencooling.services/storage/v1/object/public/mock-facebook-images/Logos/Image_202602212113.jpeg';

  let sourceUrl = productImageUrl;
  if (/\.webp(\?|$)/i.test(sourceUrl)) {
    sourceUrl = `https://wsrv.nl/?url=${encodeURIComponent(sourceUrl)}&output=jpg`;
  }

  const [tplRes, prodRes] = await Promise.all([fetch(templateUrl), fetch(sourceUrl)]);
  if (!tplRes.ok || !prodRes.ok) throw new Error('Failed to fetch template or product image');

  const [tplBuf, prodBuf] = await Promise.all([tplRes.arrayBuffer(), prodRes.arrayBuffer()]);
  const canvas = await Jimp.read(Buffer.from(tplBuf));
  const product = await Jimp.read(Buffer.from(prodBuf));

  // force story size
  canvas.resize(1080, 1920);

  // product in lower half
  product.contain(900, 760);
  const px = Math.floor((1080 - product.bitmap.width) / 2);
  const py = 860;
  canvas.composite(product, px, py);

  // subtle dark bar for text readability
  const bar = await new Jimp(1080, 180, 0x00000088);
  canvas.composite(bar, 0, 1680);

  const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  canvas.print(font, 40, 1710, {
    text: productName,
    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    alignmentY: Jimp.VERTICAL_ALIGN_TOP,
  }, 1000, 120);

  const out = await canvas.getBufferAsync(Jimp.MIME_PNG);
  const filename = `heroes/content_item_${itemId}_${Date.now()}.png`;
  const { error: upErr } = await supabase.storage.from('mock-facebook-images').upload(filename, out, {
    contentType: 'image/png', upsert: true,
  });
  if (upErr) throw new Error(upErr.message);
  const { data } = supabase.storage.from('mock-facebook-images').getPublicUrl(filename);
  return data.publicUrl
    .replace('http://localhost:8000', 'https://supabase.cravencooling.services')
    .replace('http://host.docker.internal:8000', 'https://supabase.cravencooling.services');
}

router.post('/items/:id/generate-infographic', [param('id').isUUID()], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const { item, product } = await getItemAndProduct(req.params.id);
    if (!product.infographic_url) return res.status(422).json({ error: 'Product has no infographic_url yet' });

    const prompt = buildInfographicPrompt(product as Record<string, unknown>);
    if (!prompt.trim()) return res.status(422).json({ error: 'Infographic prompt is empty' });

    await createOutput(item.id, 'infographic_image', {
      url: normalizePublicUrl(product.infographic_url),
      prompt,
      product_name: product.name,
      mode: 'infographic',
      status: 'completed',
    });

    return res.json({ ok: true, mode: 'infographic', url: normalizePublicUrl(product.infographic_url), product_name: product.name, prompt });
  } catch (err) {
    console.error('generate-infographic failed', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'generate-infographic failed' });
  }
});

router.post('/items/:id/generate-hero', [param('id').isUUID()], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const { item, product } = await getItemAndProduct(req.params.id);
    const productImage = Array.isArray(product.images) && product.images.length
      ? (product.images.find((u: string) => !/\.webp(\?|$)/i.test(u)) || product.images[0])
      : null;
    if (!productImage) return res.status(422).json({ error: 'Product has no source image' });

    const heroPrompt = buildHeroPrompt(product.name);
    const heroUrl = await generateHeroImage(item.id, product.name, productImage);

    await createOutput(item.id, 'hero_image', {
      url: heroUrl,
      prompt: heroPrompt,
      product_name: product.name,
      mode: 'hero',
      status: 'completed',
    });

    return res.json({ ok: true, mode: 'hero', url: heroUrl, product_name: product.name });
  } catch (err) {
    console.error('generate-hero failed', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'generate-hero failed' });
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
    const ids = (req.body.item_ids as string[]).slice(0, 100);
    const mode = req.body.mode as 'infographic' | 'hero' | 'both';
    const results: Array<{ item_id: string; ok: boolean; error?: string }> = [];

    for (const id of ids) {
      try {
        if (mode === 'infographic') {
          const { item, product } = await getItemAndProduct(id);
          if (!product.infographic_url) throw new Error('Product has no infographic_url yet');
          await createOutput(item.id, 'infographic_image', {
            url: normalizePublicUrl(product.infographic_url),
            prompt: buildInfographicPrompt(product as Record<string, unknown>),
            product_name: product.name,
            mode: 'infographic',
            status: 'completed',
          });
        } else if (mode === 'hero') {
          const { item, product } = await getItemAndProduct(id);
          const img = Array.isArray(product.images) && product.images.length
            ? (product.images.find((u: string) => !/\.webp(\?|$)/i.test(u)) || product.images[0])
            : null;
          if (!img) throw new Error('Product has no source image');
          const heroUrl = await generateHeroImage(item.id, product.name, img);
          await createOutput(item.id, 'hero_image', {
            url: heroUrl,
            prompt: buildHeroPrompt(product.name),
            product_name: product.name,
            mode: 'hero',
            status: 'completed',
          });
        } else {
          const { item, product } = await getItemAndProduct(id);
          if (product.infographic_url) {
            await createOutput(item.id, 'infographic_image', {
              url: normalizePublicUrl(product.infographic_url),
              prompt: buildInfographicPrompt(product as Record<string, unknown>),
              product_name: product.name,
              mode: 'infographic',
              status: 'completed',
            });
          }
          const img = Array.isArray(product.images) && product.images.length
            ? (product.images.find((u: string) => !/\.webp(\?|$)/i.test(u)) || product.images[0])
            : null;
          if (img) {
            const heroUrl = await generateHeroImage(item.id, product.name, img);
            await createOutput(item.id, 'hero_image', {
              url: heroUrl,
              prompt: buildHeroPrompt(product.name),
              product_name: product.name,
              mode: 'hero',
              status: 'completed',
            });
          }
        }
        results.push({ item_id: id, ok: true });
      } catch (e) {
        results.push({ item_id: id, ok: false, error: e instanceof Error ? e.message : 'unknown_error' });
      }
    }

    const okCount = results.filter(r => r.ok).length;
    res.json({ ok: true, processed: results.length, okCount, results });
  } catch (err) {
    console.error('Error generate-batch:', err);
    res.status(500).json({ error: 'Failed to run generate batch' });
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

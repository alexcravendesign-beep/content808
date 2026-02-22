import { Router, Request, Response } from 'express';
import { supabase, query } from '../db/connection';
import { logAudit } from '../services/audit';

const router = Router();

router.get('/calendar', async (req: Request, res: Response) => {
  try {
    const { start, end, platform, status, assignee, brand } = req.query;

    // Content items query – uses the Supabase query builder with an or
    // filter for items that have at least one date set.
    let contentQuery = supabase
      .from('content_items')
      .select('*')
      .or('publish_date.not.is.null,due_date.not.is.null');

    if (start) {
      contentQuery = contentQuery.or(`publish_date.gte.${start},due_date.gte.${start}`);
    }
    if (end) {
      contentQuery = contentQuery.or(`publish_date.lte.${end},due_date.lte.${end}`);
    }
    if (platform) {
      contentQuery = contentQuery.eq('platform', String(platform));
    }
    if (status) {
      contentQuery = contentQuery.eq('status', String(status));
    }
    if (assignee) {
      contentQuery = contentQuery.eq('assignee', String(assignee));
    }
    if (brand) {
      contentQuery = contentQuery.ilike('brand', `%${brand}%`);
    }

    const { data: contentData, error: contentError } = await contentQuery;
    if (contentError) throw new Error(contentError.message);

    // Social posts query – complex JOINs require raw SQL via exec_sql RPC
    let socialSql = `SELECT sp.id, sp.caption as brand, '' as product_url, sp.post_type as campaign_goal,
           '' as direction, '' as pivot_notes,
           CASE WHEN EXISTS (SELECT 1 FROM social_post_accounts spa JOIN social_accounts sa ON spa.social_account_id = sa.id WHERE spa.social_post_id = sp.id AND sa.account_type = 'instagram_business') THEN 'instagram'
                WHEN EXISTS (SELECT 1 FROM social_post_accounts spa JOIN social_accounts sa ON spa.social_account_id = sa.id WHERE spa.social_post_id = sp.id AND sa.account_type = 'facebook_page') THEN 'facebook'
                ELSE 'facebook' END as platform,
           sp.status, NULL as due_date, sp.scheduled_at as publish_date,
           sp.user_id as assignee, sp.user_id as created_by, sp.created_at, sp.updated_at,
           '' as product_title, '' as product_image_url, NULL as product_id, sp.caption as final_copy,
           'social_post' as item_type, sp.post_type, sp.hashtags
    FROM social_posts sp WHERE sp.scheduled_at IS NOT NULL`;
    const socialParams: unknown[] = [];
    let sIdx = 1;

    if (start) {
      socialSql += ` AND sp.scheduled_at >= $${sIdx++}`;
      socialParams.push(start);
    }
    if (end) {
      socialSql += ` AND sp.scheduled_at <= $${sIdx++}`;
      socialParams.push(end);
    }
    if (platform) {
      if (platform === 'instagram') {
        socialSql += ` AND EXISTS (SELECT 1 FROM social_post_accounts spa JOIN social_accounts sa ON spa.social_account_id = sa.id WHERE spa.social_post_id = sp.id AND sa.account_type = 'instagram_business')`;
      } else if (platform === 'facebook') {
        socialSql += ` AND EXISTS (SELECT 1 FROM social_post_accounts spa JOIN social_accounts sa ON spa.social_account_id = sa.id WHERE spa.social_post_id = sp.id AND sa.account_type = 'facebook_page')`;
      }
    }
    if (status) {
      socialSql += ` AND sp.status = $${sIdx++}`;
      socialParams.push(status);
    }

    socialSql += ' ORDER BY sp.scheduled_at ASC';

    let socialPosts: unknown[] = [];
    try {
      const socialResult = await query(socialSql, socialParams);
      socialPosts = socialResult.rows.map((row: Record<string, unknown>) => ({ ...row, item_type: 'social_post' }));
    } catch {
      // social tables may not exist yet
    }

    const contentItems = (contentData || []).map((row: Record<string, unknown>) => ({ ...row, item_type: 'content_item' }));
    const allItems = [...contentItems, ...socialPosts] as Record<string, unknown>[];
    allItems.sort((a, b) => {
      const dateA = (a.publish_date || a.due_date) as string;
      const dateB = (b.publish_date || b.due_date) as string;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

    res.json({ items: allItems });
  } catch (err) {
    console.error('Error fetching calendar items:', err);
    res.status(500).json({ error: 'Failed to fetch calendar items' });
  }
});

router.put('/calendar/:id/reschedule', async (req: Request, res: Response) => {
  try {
    const { publish_date, due_date } = req.body;
    const { data: existing, error: fetchError } = await supabase
      .from('content_items')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!existing) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const updateObj: Record<string, unknown> = {};

    if (publish_date !== undefined) {
      updateObj.publish_date = publish_date;
    }
    if (due_date !== undefined) {
      updateObj.due_date = due_date;
    }

    if (Object.keys(updateObj).length === 0) {
      return res.status(400).json({ error: 'No date fields provided' });
    }

    const { error: updateError } = await supabase
      .from('content_items')
      .update(updateObj)
      .eq('id', req.params.id);
    if (updateError) throw new Error(updateError.message);

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

    const { data } = await supabase.from('content_items').select('*').eq('id', req.params.id).single();
    res.json(data);
  } catch (err) {
    console.error('Error rescheduling item:', err);
    res.status(500).json({ error: 'Failed to reschedule item' });
  }
});

export default router;

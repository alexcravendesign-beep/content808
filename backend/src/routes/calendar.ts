import { Router, Request, Response } from 'express';
import { supabase } from '../db/connection';
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

    // Social posts query – use Supabase query builder with embedded accounts
    let socialPosts: unknown[] = [];
    try {
      let socialQuery = supabase
        .from('social_posts')
        .select('*, social_post_accounts(social_accounts(account_type))')
        .not('scheduled_at', 'is', null)
        .order('scheduled_at', { ascending: true });

      if (start) {
        socialQuery = socialQuery.gte('scheduled_at', String(start));
      }
      if (end) {
        socialQuery = socialQuery.lte('scheduled_at', String(end));
      }
      if (status) {
        socialQuery = socialQuery.eq('status', String(status));
      }

      const { data: socialData, error: socialError } = await socialQuery;
      if (socialError) throw socialError;

      // Transform social posts into calendar item shape and apply platform filter
      socialPosts = (socialData || [])
        .map((sp: Record<string, unknown>) => {
          const accountsArr = (sp.social_post_accounts || []) as Array<Record<string, unknown>>;
          const accountTypes = accountsArr
            .map((spa) => ((spa.social_accounts || {}) as Record<string, unknown>).account_type as string)
            .filter(Boolean);

          const detectedPlatform = accountTypes.includes('instagram_business')
            ? 'instagram'
            : accountTypes.includes('facebook_page')
            ? 'facebook'
            : 'facebook';

          return {
            id: sp.id, brand: sp.caption, product_url: '', campaign_goal: sp.post_type,
            direction: '', pivot_notes: '', platform: detectedPlatform,
            status: sp.status, due_date: null, publish_date: sp.scheduled_at,
            assignee: sp.user_id, created_by: sp.user_id, created_at: sp.created_at, updated_at: sp.updated_at,
            product_title: '', product_image_url: '', product_id: null, final_copy: sp.caption,
            item_type: 'social_post', post_type: sp.post_type, hashtags: sp.hashtags,
          };
        })
        .filter((item: Record<string, unknown>) => {
          if (!platform) return true;
          return item.platform === String(platform);
        });
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

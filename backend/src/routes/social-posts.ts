import { Router, Request, Response } from 'express';
import { supabase, query } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { logAudit } from '../services/audit';

const router = Router();

router.get('/social/posts', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { status, limit: limitParam, offset: offsetParam } = req.query;

    const pageLimit = Math.min(parseInt(limitParam as string) || 50, 200);
    const pageOffset = parseInt(offsetParam as string) || 0;

    // Complex JOINs with aggregations require raw SQL via exec_sql RPC
    let sql = `SELECT sp.*,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', ml.id, 'url', ml.url, 'thumbnail_url', ml.thumbnail_url, 'file_type', ml.file_type, 'file_name', ml.file_name)) FILTER (WHERE ml.id IS NOT NULL),
        '[]'
      ) as media,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', spa.id, 'social_account_id', spa.social_account_id, 'platform_post_id', spa.platform_post_id, 'platform_status', spa.platform_status, 'platform_error', spa.platform_error, 'published_at', spa.published_at, 'account_name', sa.account_name, 'account_type', sa.account_type, 'account_avatar_url', sa.account_avatar_url)) FILTER (WHERE spa.id IS NOT NULL),
        '[]'
      ) as target_accounts
    FROM social_posts sp
    LEFT JOIN social_post_media spm ON sp.id = spm.social_post_id
    LEFT JOIN media_library ml ON spm.media_id = ml.id
    LEFT JOIN social_post_accounts spa ON sp.id = spa.social_post_id
    LEFT JOIN social_accounts sa ON spa.social_account_id = sa.id
    WHERE sp.user_id = $1`;

    const params: unknown[] = [userId];
    let idx = 2;

    if (status) {
      sql += ` AND sp.status = $${idx++}`;
      params.push(status);
    }

    sql += ` GROUP BY sp.id ORDER BY COALESCE(sp.scheduled_at, sp.created_at) DESC`;
    sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(pageLimit, pageOffset);

    const result = await query(sql, params);

    const countResult = await query(
      `SELECT COUNT(*)::int as count FROM social_posts WHERE user_id = $1${status ? ' AND status = $2' : ''}`,
      status ? [userId, status] : [userId]
    );

    res.json({
      posts: result.rows,
      total: countResult.rows[0]?.count ?? 0,
      limit: pageLimit,
      offset: pageOffset,
    });
  } catch (err) {
    console.error('Error fetching social posts:', err);
    res.status(500).json({ error: 'Failed to fetch social posts' });
  }
});

router.get('/social/posts/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    // Complex JOIN query – use raw SQL via RPC wrapper
    const result = await query(
      `SELECT sp.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', ml.id, 'url', ml.url, 'thumbnail_url', ml.thumbnail_url, 'file_type', ml.file_type, 'file_name', ml.file_name, 'sort_order', spm.sort_order)) FILTER (WHERE ml.id IS NOT NULL),
          '[]'
        ) as media,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', spa.id, 'social_account_id', spa.social_account_id, 'platform_post_id', spa.platform_post_id, 'platform_status', spa.platform_status, 'platform_error', spa.platform_error, 'published_at', spa.published_at, 'account_name', sa.account_name, 'account_type', sa.account_type, 'account_avatar_url', sa.account_avatar_url)) FILTER (WHERE spa.id IS NOT NULL),
          '[]'
        ) as target_accounts
      FROM social_posts sp
      LEFT JOIN social_post_media spm ON sp.id = spm.social_post_id
      LEFT JOIN media_library ml ON spm.media_id = ml.id
      LEFT JOIN social_post_accounts spa ON sp.id = spa.social_post_id
      LEFT JOIN social_accounts sa ON spa.social_account_id = sa.id
      WHERE sp.id = $1 AND sp.user_id = $2
      GROUP BY sp.id`,
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching social post:', err);
    res.status(500).json({ error: 'Failed to fetch social post' });
  }
});

router.post('/social/posts', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const {
      caption = '',
      hashtags = '',
      post_type = 'image',
      scheduled_at = null,
      content_item_id = null,
      account_ids = [],
      media_ids = [],
    } = req.body;

    const postId = uuidv4();
    const postStatus = scheduled_at ? 'scheduled' : 'draft';

    const { error: insertError } = await supabase.from('social_posts').insert({
      id: postId,
      user_id: userId,
      content_item_id,
      caption,
      hashtags,
      post_type,
      status: postStatus,
      scheduled_at,
    });
    if (insertError) throw new Error(insertError.message);

    for (let i = 0; i < (media_ids as string[]).length; i++) {
      const { error: mediaErr } = await supabase.from('social_post_media').insert({
        id: uuidv4(),
        social_post_id: postId,
        media_id: media_ids[i],
        sort_order: i,
      });
      if (mediaErr) throw new Error(mediaErr.message);
    }

    for (const accountId of account_ids as string[]) {
      const { error: acctErr } = await supabase.from('social_post_accounts').insert({
        id: uuidv4(),
        social_post_id: postId,
        social_account_id: accountId,
      });
      if (acctErr) throw new Error(acctErr.message);
    }

    await logAudit({
      entityType: 'social_post',
      entityId: postId,
      action: 'create',
      actor: userId,
      actorRole: req.user?.role || 'staff',
      details: { post_type, status: postStatus, account_count: (account_ids as string[]).length },
    });

    const { data } = await supabase.from('social_posts').select('*').eq('id', postId).single();
    res.status(201).json(data);
  } catch (err) {
    console.error('Error creating social post:', err);
    res.status(500).json({ error: 'Failed to create social post' });
  }
});

router.put('/social/posts/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { data: existing, error: fetchError } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);

    if (!existing) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (existing.status === 'published' || existing.status === 'publishing') {
      return res.status(400).json({ error: 'Cannot edit a published or publishing post' });
    }

    const { caption, hashtags, post_type, scheduled_at, account_ids, media_ids } = req.body;

    const updateObj: Record<string, unknown> = {};
    if (caption !== undefined) updateObj.caption = caption;
    if (hashtags !== undefined) updateObj.hashtags = hashtags;
    if (post_type !== undefined) updateObj.post_type = post_type;
    if (scheduled_at !== undefined) {
      updateObj.scheduled_at = scheduled_at;
      if (scheduled_at && existing.status === 'draft') {
        updateObj.status = 'scheduled';
      } else if (!scheduled_at && existing.status === 'scheduled') {
        updateObj.status = 'draft';
      }
    }

    if (Object.keys(updateObj).length > 0) {
      const { error: updateError } = await supabase
        .from('social_posts')
        .update(updateObj)
        .eq('id', req.params.id);
      if (updateError) throw new Error(updateError.message);
    }

    if (media_ids !== undefined) {
      const { error: delMediaErr } = await supabase.from('social_post_media').delete().eq('social_post_id', req.params.id);
      if (delMediaErr) throw new Error(delMediaErr.message);
      for (let i = 0; i < (media_ids as string[]).length; i++) {
        const { error: mediaErr } = await supabase.from('social_post_media').insert({
          id: uuidv4(),
          social_post_id: req.params.id,
          media_id: media_ids[i],
          sort_order: i,
        });
        if (mediaErr) throw new Error(mediaErr.message);
      }
    }

    if (account_ids !== undefined) {
      const { error: delAcctErr } = await supabase.from('social_post_accounts').delete().eq('social_post_id', req.params.id);
      if (delAcctErr) throw new Error(delAcctErr.message);
      for (const accountId of account_ids as string[]) {
        const { error: acctErr } = await supabase.from('social_post_accounts').insert({
          id: uuidv4(),
          social_post_id: req.params.id,
          social_account_id: accountId,
        });
        if (acctErr) throw new Error(acctErr.message);
      }
    }

    await logAudit({
      entityType: 'social_post',
      entityId: req.params.id,
      action: 'update',
      actor: userId,
      actorRole: req.user?.role || 'staff',
      details: { updated_fields: Object.keys(req.body) },
    });

    const { data } = await supabase.from('social_posts').select('*').eq('id', req.params.id).single();
    res.json(data);
  } catch (err) {
    console.error('Error updating social post:', err);
    res.status(500).json({ error: 'Failed to update social post' });
  }
});

router.delete('/social/posts/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { data: existing, error: fetchError } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);

    if (!existing) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (existing.status === 'publishing') {
      return res.status(400).json({ error: 'Cannot delete a post that is currently publishing' });
    }

    const { error: deleteError } = await supabase.from('social_posts').delete().eq('id', req.params.id);
    if (deleteError) throw new Error(deleteError.message);

    await logAudit({
      entityType: 'social_post',
      entityId: req.params.id,
      action: 'delete',
      actor: userId,
      actorRole: req.user?.role || 'staff',
      details: {},
    });

    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error('Error deleting social post:', err);
    res.status(500).json({ error: 'Failed to delete social post' });
  }
});

router.post('/social/posts/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { data: existing, error: fetchError } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);

    if (!existing) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const newId = uuidv4();

    const { error: insertError } = await supabase.from('social_posts').insert({
      id: newId,
      user_id: userId,
      content_item_id: existing.content_item_id,
      caption: existing.caption,
      hashtags: existing.hashtags,
      post_type: existing.post_type,
      status: 'draft',
    });
    if (insertError) throw new Error(insertError.message);

    const { data: mediaRows } = await supabase
      .from('social_post_media')
      .select('*')
      .eq('social_post_id', req.params.id)
      .order('sort_order', { ascending: true });

    for (const media of mediaRows || []) {
      const { error: mediaErr } = await supabase.from('social_post_media').insert({
        id: uuidv4(),
        social_post_id: newId,
        media_id: media.media_id,
        sort_order: media.sort_order,
      });
      if (mediaErr) throw new Error(mediaErr.message);
    }

    const { data: accountRows } = await supabase
      .from('social_post_accounts')
      .select('*')
      .eq('social_post_id', req.params.id);

    for (const account of accountRows || []) {
      const { error: acctErr } = await supabase.from('social_post_accounts').insert({
        id: uuidv4(),
        social_post_id: newId,
        social_account_id: account.social_account_id,
      });
      if (acctErr) throw new Error(acctErr.message);
    }

    await logAudit({
      entityType: 'social_post',
      entityId: newId,
      action: 'duplicate',
      actor: userId,
      actorRole: req.user?.role || 'staff',
      details: { original_id: req.params.id },
    });

    const { data } = await supabase.from('social_posts').select('*').eq('id', newId).single();
    res.status(201).json(data);
  } catch (err) {
    console.error('Error duplicating social post:', err);
    res.status(500).json({ error: 'Failed to duplicate social post' });
  }
});

router.post('/social/posts/:id/publish', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { data: existing, error: fetchError } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);

    if (!existing) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (existing.status === 'published' || existing.status === 'publishing') {
      return res.status(400).json({ error: 'Post is already published or publishing' });
    }

    const { error: statusErr } = await supabase
      .from('social_posts')
      .update({ status: 'publishing' })
      .eq('id', req.params.id);
    if (statusErr) throw new Error(statusErr.message);

    const { error: acctStatusErr } = await supabase
      .from('social_post_accounts')
      .update({ platform_status: 'publishing' })
      .eq('social_post_id', req.params.id);
    if (acctStatusErr) throw new Error(acctStatusErr.message);

    try {
      const { publishToAccounts } = await import('../services/meta-publisher');
      await publishToAccounts(req.params.id);
    } catch (pubErr) {
      console.error('Publishing error:', pubErr);
      const { error: failErr } = await supabase
        .from('social_posts')
        .update({
          status: 'failed',
          error_message: (pubErr as Error).message,
        })
        .eq('id', req.params.id);
      if (failErr) console.error('Error updating post status:', failErr.message);
    }

    const { data } = await supabase.from('social_posts').select('*').eq('id', req.params.id).single();
    res.json(data);
  } catch (err) {
    console.error('Error publishing social post:', err);
    res.status(500).json({ error: 'Failed to publish social post' });
  }
});

router.put('/social/posts/:id/reschedule', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { scheduled_at } = req.body;

    const { data: existing, error: fetchError } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);

    if (!existing) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (existing.status === 'published' || existing.status === 'publishing') {
      return res.status(400).json({ error: 'Cannot reschedule a published or publishing post' });
    }

    const newStatus = scheduled_at ? 'scheduled' : 'draft';
    const { error: updateError } = await supabase
      .from('social_posts')
      .update({ scheduled_at, status: newStatus })
      .eq('id', req.params.id);
    if (updateError) throw new Error(updateError.message);

    await logAudit({
      entityType: 'social_post',
      entityId: req.params.id,
      action: 'reschedule',
      actor: userId,
      actorRole: req.user?.role || 'staff',
      details: { scheduled_at },
    });

    const { data } = await supabase.from('social_posts').select('*').eq('id', req.params.id).single();
    res.json(data);
  } catch (err) {
    console.error('Error rescheduling social post:', err);
    res.status(500).json({ error: 'Failed to reschedule social post' });
  }
});

export default router;

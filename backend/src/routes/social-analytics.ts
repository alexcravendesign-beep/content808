import { Router, Request, Response } from 'express';
import { supabase, query } from '../db/connection';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const GRAPH_URL = `https://graph.facebook.com/${config.meta.graphApiVersion}`;

router.get('/social/analytics', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { post_id, account_id } = req.query;

    // Complex JOIN query – use raw SQL via RPC wrapper
    let sql = `SELECT spa.*, sp.caption, sp.post_type, sp.published_at as post_published_at,
                      sa.account_name, sa.account_type, sa.account_avatar_url
               FROM social_post_analytics spa
               JOIN social_posts sp ON spa.social_post_id = sp.id
               JOIN social_accounts sa ON spa.social_account_id = sa.id
               WHERE sp.user_id = $1`;
    const params: unknown[] = [userId];
    let idx = 2;

    if (post_id) {
      sql += ` AND spa.social_post_id = $${idx++}`;
      params.push(post_id);
    }
    if (account_id) {
      sql += ` AND spa.social_account_id = $${idx++}`;
      params.push(account_id);
    }

    sql += ' ORDER BY spa.fetched_at DESC';

    const result = await query(sql, params);
    res.json({ analytics: result.rows });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.get('/social/analytics/summary', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';

    // Complex aggregation queries – use raw SQL via RPC wrapper
    const totalPosts = await query(
      "SELECT COUNT(*)::int as count FROM social_posts WHERE user_id = $1 AND status = 'published'",
      [userId]
    );

    const totalEngagement = await query(
      `SELECT COALESCE(SUM(impressions), 0)::int as total_impressions,
              COALESCE(SUM(reach), 0)::int as total_reach,
              COALESCE(SUM(engagement), 0)::int as total_engagement,
              COALESCE(SUM(likes), 0)::int as total_likes,
              COALESCE(SUM(comments), 0)::int as total_comments,
              COALESCE(SUM(shares), 0)::int as total_shares,
              COALESCE(SUM(saves), 0)::int as total_saves,
              COALESCE(SUM(clicks), 0)::int as total_clicks
       FROM social_post_analytics spa
       JOIN social_posts sp ON spa.social_post_id = sp.id
       WHERE sp.user_id = $1`,
      [userId]
    );

    const byPlatform = await query(
      `SELECT sa.account_type,
              COUNT(DISTINCT sp.id)::int as post_count,
              COALESCE(SUM(spa.impressions), 0)::int as impressions,
              COALESCE(SUM(spa.reach), 0)::int as reach,
              COALESCE(SUM(spa.engagement), 0)::int as engagement
       FROM social_post_analytics spa
       JOIN social_posts sp ON spa.social_post_id = sp.id
       JOIN social_accounts sa ON spa.social_account_id = sa.id
       WHERE sp.user_id = $1
       GROUP BY sa.account_type`,
      [userId]
    );

    const recentPosts = await query(
      `SELECT sp.id, sp.caption, sp.post_type, sp.published_at,
              COALESCE(SUM(spa.impressions), 0)::int as impressions,
              COALESCE(SUM(spa.reach), 0)::int as reach,
              COALESCE(SUM(spa.engagement), 0)::int as engagement,
              COALESCE(SUM(spa.likes), 0)::int as likes
       FROM social_posts sp
       LEFT JOIN social_post_analytics spa ON sp.id = spa.social_post_id
       WHERE sp.user_id = $1 AND sp.status = 'published'
       GROUP BY sp.id
       ORDER BY sp.published_at DESC
       LIMIT 10`,
      [userId]
    );

    const statusCounts = await query(
      `SELECT status, COUNT(*)::int as count FROM social_posts WHERE user_id = $1 GROUP BY status`,
      [userId]
    );

    const byStatus: Record<string, number> = {};
    for (const row of statusCounts.rows) {
      byStatus[row.status] = row.count;
    }

    res.json({
      total_published: totalPosts.rows[0]?.count ?? 0,
      ...totalEngagement.rows[0],
      by_platform: byPlatform.rows,
      recent_posts: recentPosts.rows,
      by_status: byStatus,
    });
  } catch (err) {
    console.error('Error fetching analytics summary:', err);
    res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
});

router.post('/social/analytics/fetch/:postId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { postId } = req.params;

    const { data: postData, error: postError } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', postId)
      .eq('user_id', userId)
      .eq('status', 'published')
      .maybeSingle();
    if (postError) throw new Error(postError.message);

    if (!postData) {
      return res.status(404).json({ error: 'Published post not found' });
    }

    // Complex JOIN – use raw SQL via RPC wrapper
    const accountsResult = await query(
      `SELECT spa.*, sa.account_type, sa.access_token, sa.page_id, sa.instagram_account_id
       FROM social_post_accounts spa
       JOIN social_accounts sa ON spa.social_account_id = sa.id
       WHERE spa.social_post_id = $1 AND spa.platform_status = 'published'`,
      [postId]
    );

    const results = [];

    for (const account of accountsResult.rows) {
      try {
        let metrics = { impressions: 0, reach: 0, engagement: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 };

        if (account.platform_post_id) {
          if (account.account_type === 'facebook_page') {
            metrics = await fetchFacebookInsights(account.platform_post_id, account.access_token);
          } else if (account.account_type === 'instagram_business') {
            metrics = await fetchInstagramInsights(account.platform_post_id, account.access_token);
          }
        }

        const { error: insertError } = await supabase.from('social_post_analytics').insert({
          id: uuidv4(),
          social_post_id: postId,
          social_account_id: account.social_account_id,
          platform_post_id: account.platform_post_id,
          impressions: metrics.impressions,
          reach: metrics.reach,
          engagement: metrics.engagement,
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
          saves: metrics.saves,
          clicks: metrics.clicks,
        });
        if (insertError) throw new Error(insertError.message);

        results.push({ account_id: account.social_account_id, ...metrics });
      } catch (fetchErr) {
        console.error(`Error fetching insights for account ${account.social_account_id}:`, fetchErr);
        results.push({ account_id: account.social_account_id, error: (fetchErr as Error).message });
      }
    }

    res.json({ post_id: postId, analytics: results });
  } catch (err) {
    console.error('Error fetching post analytics:', err);
    res.status(500).json({ error: 'Failed to fetch post analytics' });
  }
});

async function fetchFacebookInsights(postId: string, accessToken: string) {
  const metrics = { impressions: 0, reach: 0, engagement: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 };

  try {
    const insightsRes = await fetch(
      `${GRAPH_URL}/${postId}/insights?metric=post_impressions,post_engaged_users,post_clicks&access_token=${accessToken}`
    );
    const insightsData = await insightsRes.json() as { data?: Array<{ name: string; values: Array<{ value: number }> }> };

    if (insightsData.data) {
      for (const metric of insightsData.data) {
        const value = metric.values?.[0]?.value || 0;
        switch (metric.name) {
          case 'post_impressions': metrics.impressions = value; break;
          case 'post_engaged_users': metrics.engagement = value; break;
          case 'post_clicks': metrics.clicks = value; break;
        }
      }
    }

    const reactionsRes = await fetch(
      `${GRAPH_URL}/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${accessToken}`
    );
    const reactionsData = await reactionsRes.json() as {
      likes?: { summary?: { total_count?: number } };
      comments?: { summary?: { total_count?: number } };
      shares?: { count?: number };
    };

    metrics.likes = reactionsData.likes?.summary?.total_count || 0;
    metrics.comments = reactionsData.comments?.summary?.total_count || 0;
    metrics.shares = reactionsData.shares?.count || 0;
  } catch (err) {
    console.error('Error fetching Facebook insights:', err);
  }

  return metrics;
}

async function fetchInstagramInsights(mediaId: string, accessToken: string) {
  const metrics = { impressions: 0, reach: 0, engagement: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0 };

  try {
    const insightsRes = await fetch(
      `${GRAPH_URL}/${mediaId}/insights?metric=impressions,reach,saved,engagement&access_token=${accessToken}`
    );
    const insightsData = await insightsRes.json() as { data?: Array<{ name: string; values: Array<{ value: number }> }> };

    if (insightsData.data) {
      for (const metric of insightsData.data) {
        const value = metric.values?.[0]?.value || 0;
        switch (metric.name) {
          case 'impressions': metrics.impressions = value; break;
          case 'reach': metrics.reach = value; break;
          case 'saved': metrics.saves = value; break;
          case 'engagement': metrics.engagement = value; break;
        }
      }
    }

    const mediaRes = await fetch(
      `${GRAPH_URL}/${mediaId}?fields=like_count,comments_count&access_token=${accessToken}`
    );
    const mediaData = await mediaRes.json() as { like_count?: number; comments_count?: number };

    metrics.likes = mediaData.like_count || 0;
    metrics.comments = mediaData.comments_count || 0;
  } catch (err) {
    console.error('Error fetching Instagram insights:', err);
  }

  return metrics;
}

export default router;

import { Router, Request, Response } from 'express';
import { supabase } from '../db/connection';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const GRAPH_URL = `https://graph.facebook.com/${config.meta.graphApiVersion}`;

router.get('/social/analytics', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { post_id, account_id } = req.query;

    // Use Supabase embedded resources for JOINs
    let analyticsQuery = supabase
      .from('social_post_analytics')
      .select(`
        *,
        social_posts!inner(caption, post_type, published_at, user_id),
        social_accounts(account_name, account_type, account_avatar_url)
      `)
      .eq('social_posts.user_id', userId)
      .order('fetched_at', { ascending: false });

    if (post_id) {
      analyticsQuery = analyticsQuery.eq('social_post_id', String(post_id));
    }
    if (account_id) {
      analyticsQuery = analyticsQuery.eq('social_account_id', String(account_id));
    }

    const { data: analyticsData, error: analyticsError } = await analyticsQuery;
    if (analyticsError) throw new Error(analyticsError.message);

    // Flatten embedded data to match expected shape
    const analytics = (analyticsData || []).map((row: Record<string, unknown>) => {
      const sp = (row.social_posts || {}) as Record<string, unknown>;
      const sa = (row.social_accounts || {}) as Record<string, unknown>;
      const { social_posts: _ignorePost, social_accounts: _ignoreAcct, ...rest } = row;
      void _ignorePost; void _ignoreAcct;
      return {
        ...rest,
        caption: sp.caption,
        post_type: sp.post_type,
        post_published_at: sp.published_at,
        account_name: sa.account_name,
        account_type: sa.account_type,
        account_avatar_url: sa.account_avatar_url,
      };
    });

    res.json({ analytics });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.get('/social/analytics/summary', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';

    // Count published posts
    const { count: publishedCount, error: countError } = await supabase
      .from('social_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'published');
    if (countError) throw new Error(countError.message);

    // Fetch all analytics rows for this user's posts to aggregate in JS
    const { data: allAnalytics, error: engError } = await supabase
      .from('social_post_analytics')
      .select(`
        *,
        social_posts!inner(user_id),
        social_accounts(account_type)
      `)
      .eq('social_posts.user_id', userId);
    if (engError) throw new Error(engError.message);

    const rows = allAnalytics || [];

    // Aggregate totals
    let total_impressions = 0, total_reach = 0, total_engagement = 0;
    let total_likes = 0, total_comments = 0, total_shares = 0, total_saves = 0, total_clicks = 0;
    for (const r of rows) {
      total_impressions += (r.impressions as number) || 0;
      total_reach += (r.reach as number) || 0;
      total_engagement += (r.engagement as number) || 0;
      total_likes += (r.likes as number) || 0;
      total_comments += (r.comments as number) || 0;
      total_shares += (r.shares as number) || 0;
      total_saves += (r.saves as number) || 0;
      total_clicks += (r.clicks as number) || 0;
    }

    // Aggregate by platform
    const platformMap: Record<string, { post_count: Set<string>; impressions: number; reach: number; engagement: number }> = {};
    for (const r of rows) {
      const sa = (r as Record<string, unknown>).social_accounts as Record<string, unknown> | null;
      const acctType = (sa?.account_type as string) || 'unknown';
      if (!platformMap[acctType]) platformMap[acctType] = { post_count: new Set(), impressions: 0, reach: 0, engagement: 0 };
      platformMap[acctType].post_count.add(r.social_post_id as string);
      platformMap[acctType].impressions += (r.impressions as number) || 0;
      platformMap[acctType].reach += (r.reach as number) || 0;
      platformMap[acctType].engagement += (r.engagement as number) || 0;
    }
    const by_platform = Object.entries(platformMap).map(([account_type, v]) => ({
      account_type,
      post_count: v.post_count.size,
      impressions: v.impressions,
      reach: v.reach,
      engagement: v.engagement,
    }));

    // Recent published posts with analytics
    const { data: recentPostsData, error: recentError } = await supabase
      .from('social_posts')
      .select('id, caption, post_type, published_at, social_post_analytics(*)')
      .eq('user_id', userId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(10);
    if (recentError) throw new Error(recentError.message);

    const recent_posts = (recentPostsData || []).map((sp: Record<string, unknown>) => {
      const analyticsArr = (sp.social_post_analytics || []) as Array<Record<string, number>>;
      let impressions = 0, reach = 0, engagement = 0, likes = 0;
      for (const a of analyticsArr) {
        impressions += a.impressions || 0;
        reach += a.reach || 0;
        engagement += a.engagement || 0;
        likes += a.likes || 0;
      }
      return { id: sp.id, caption: sp.caption, post_type: sp.post_type, published_at: sp.published_at, impressions, reach, engagement, likes };
    });

    // Status counts
    const { data: allPosts, error: postsError } = await supabase
      .from('social_posts')
      .select('status')
      .eq('user_id', userId);
    if (postsError) throw new Error(postsError.message);

    const byStatus: Record<string, number> = {};
    for (const p of allPosts || []) {
      byStatus[p.status as string] = (byStatus[p.status as string] || 0) + 1;
    }

    res.json({
      total_published: publishedCount ?? 0,
      total_impressions, total_reach, total_engagement,
      total_likes, total_comments, total_shares, total_saves, total_clicks,
      by_platform,
      recent_posts,
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

    // Fetch post accounts with their social account details using embedded resources
    const { data: postAccounts, error: acctError } = await supabase
      .from('social_post_accounts')
      .select('*, social_accounts(account_type, access_token, page_id, instagram_account_id)')
      .eq('social_post_id', postId)
      .eq('platform_status', 'published');
    if (acctError) throw new Error(acctError.message);

    // Flatten joined data
    const accountRows = (postAccounts || []).map((spa: Record<string, unknown>) => {
      const sa = spa.social_accounts as Record<string, unknown> | null;
      return {
        id: spa.id as string,
        social_account_id: spa.social_account_id as string,
        social_post_id: spa.social_post_id as string,
        platform_post_id: spa.platform_post_id as string | null,
        platform_status: spa.platform_status as string | null,
        account_type: (sa?.account_type ?? '') as string,
        access_token: (sa?.access_token ?? '') as string,
        page_id: (sa?.page_id ?? '') as string,
        instagram_account_id: (sa?.instagram_account_id ?? '') as string,
      };
    });

    const results = [];

    for (const account of accountRows) {
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

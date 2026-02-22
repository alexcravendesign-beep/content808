import { Router, Request, Response } from 'express';
import { config } from '../config';
import { supabase } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const GRAPH_URL = `https://graph.facebook.com/${config.meta.graphApiVersion}`;
const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
  'pages_read_user_content',
].join(',');

router.get('/meta/auth', (req: Request, res: Response) => {
  const state = uuidv4();
  const userId = req.user?.id || 'unknown';

  const authUrl = new URL('https://www.facebook.com/' + config.meta.graphApiVersion + '/dialog/oauth');
  authUrl.searchParams.set('client_id', config.meta.appId);
  authUrl.searchParams.set('redirect_uri', config.meta.callbackUrl);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', `${state}:${userId}`);
  authUrl.searchParams.set('response_type', 'code');

  res.json({ url: authUrl.toString(), state });
});

router.get('/meta/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.redirect(`${config.frontendUrl}/social/accounts?error=${encodeURIComponent(error_description as string || 'Authorization denied')}`);
    }

    if (!code || !state) {
      return res.redirect(`${config.frontendUrl}/social/accounts?error=Missing authorization code`);
    }

    const [, userId] = (state as string).split(':');
    if (!userId) {
      return res.redirect(`${config.frontendUrl}/social/accounts?error=Invalid state parameter`);
    }

    const tokenUrl = `${GRAPH_URL}/oauth/access_token`;
    const tokenParams = new URLSearchParams({
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      redirect_uri: config.meta.callbackUrl,
      code: code as string,
    });

    const tokenRes = await fetch(`${tokenUrl}?${tokenParams.toString()}`);
    const tokenData = await tokenRes.json() as { access_token?: string; error?: { message: string } };

    if (!tokenData.access_token) {
      return res.redirect(`${config.frontendUrl}/social/accounts?error=${encodeURIComponent(tokenData.error?.message || 'Failed to get access token')}`);
    }

    const shortToken = tokenData.access_token;

    const longTokenRes = await fetch(
      `${GRAPH_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.meta.appId}&client_secret=${config.meta.appSecret}&fb_exchange_token=${shortToken}`
    );
    const longTokenData = await longTokenRes.json() as { access_token?: string; expires_in?: number };
    const longLivedToken = longTokenData.access_token || shortToken;
    const tokenExpiresIn = longTokenData.expires_in || 3600;
    const tokenExpiresAt = new Date(Date.now() + tokenExpiresIn * 1000);
    const isLongLived = !!longTokenData.access_token;

    const pagesRes = await fetch(`${GRAPH_URL}/me/accounts?access_token=${longLivedToken}&fields=id,name,picture,access_token,instagram_business_account`);
    const pagesData = await pagesRes.json() as { data?: Array<{ id: string; name: string; picture?: { data?: { url?: string } }; access_token: string; instagram_business_account?: { id: string } }> };

    if (!pagesData.data || pagesData.data.length === 0) {
      return res.redirect(`${config.frontendUrl}/social/accounts?error=No Facebook Pages found. Please make sure you have admin access to at least one Facebook Page.`);
    }

    let connectedCount = 0;

    for (const page of pagesData.data) {
      const pageId = page.id;
      const pageName = page.name;
      const pageAvatar = page.picture?.data?.url || '';
      const pageToken = page.access_token;

      const { error: upsertError } = await supabase.from('social_accounts').upsert(
        {
          id: uuidv4(),
          user_id: userId,
          provider: 'meta',
          provider_account_id: pageId,
          account_type: 'facebook_page',
          account_name: pageName,
          account_avatar_url: pageAvatar,
          access_token: pageToken,
          token_expires_at: tokenExpiresAt.toISOString(),
          long_lived_token: isLongLived,
          page_id: pageId,
          metadata: { page_category: '' },
          is_active: true,
        },
        { onConflict: 'user_id,provider,provider_account_id' }
      );
      if (upsertError) throw new Error(upsertError.message);
      connectedCount++;

      if (page.instagram_business_account) {
        const igId = page.instagram_business_account.id;
        const igRes = await fetch(`${GRAPH_URL}/${igId}?fields=id,name,username,profile_picture_url&access_token=${pageToken}`);
        const igData = await igRes.json() as { id?: string; name?: string; username?: string; profile_picture_url?: string };

        if (igData.id) {
          const { error: igUpsertError } = await supabase.from('social_accounts').upsert(
            {
              id: uuidv4(),
              user_id: userId,
              provider: 'meta',
              provider_account_id: igId,
              account_type: 'instagram_business',
              account_name: igData.username || igData.name || 'Instagram',
              account_avatar_url: igData.profile_picture_url || '',
              access_token: pageToken,
              token_expires_at: tokenExpiresAt.toISOString(),
              long_lived_token: isLongLived,
              page_id: pageId,
              instagram_account_id: igId,
              metadata: { username: igData.username || '' },
              is_active: true,
            },
            { onConflict: 'user_id,provider,provider_account_id' }
          );
          if (igUpsertError) throw new Error(igUpsertError.message);
          connectedCount++;
        }
      }
    }

    res.redirect(`${config.frontendUrl}/social/accounts?connected=${connectedCount}`);
  } catch (err) {
    console.error('Meta OAuth callback error:', err);
    res.redirect(`${config.frontendUrl}/social/accounts?error=Connection failed. Please try again.`);
  }
});

router.post('/meta/refresh-token/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    const userId = req.user?.id || 'unknown';

    const { data: account, error: fetchError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const currentToken = account.access_token;

    const refreshRes = await fetch(
      `${GRAPH_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.meta.appId}&client_secret=${config.meta.appSecret}&fb_exchange_token=${currentToken}`
    );
    const refreshData = await refreshRes.json() as { access_token?: string; expires_in?: number; error?: { message: string } };

    if (!refreshData.access_token) {
      return res.status(400).json({ error: refreshData.error?.message || 'Failed to refresh token' });
    }

    const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 5184000) * 1000);

    const { error: updateError } = await supabase
      .from('social_accounts')
      .update({
        access_token: refreshData.access_token,
        token_expires_at: newExpiresAt.toISOString(),
        long_lived_token: true,
      })
      .eq('id', accountId);
    if (updateError) throw new Error(updateError.message);

    res.json({ message: 'Token refreshed', expires_at: newExpiresAt });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

export default router;

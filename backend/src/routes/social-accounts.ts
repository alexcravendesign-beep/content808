import { Router, Request, Response } from 'express';
import { supabase } from '../db/connection';

const router = Router();

const ACCOUNT_COLUMNS = 'id, user_id, provider, provider_account_id, account_type, account_name, account_avatar_url, token_expires_at, long_lived_token, page_id, instagram_account_id, is_active, metadata, created_at, updated_at';

router.get('/social/accounts', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { data, error } = await supabase
      .from('social_accounts')
      .select(ACCOUNT_COLUMNS)
      .eq('user_id', userId)
      .order('account_type', { ascending: true })
      .order('account_name', { ascending: true });
    if (error) throw new Error(error.message);

    const accounts = (data || []).map((row) => ({
      ...row,
      token_status: getTokenStatus(row.token_expires_at),
    }));

    res.json({ accounts });
  } catch (err) {
    console.error('Error fetching social accounts:', err);
    res.status(500).json({ error: 'Failed to fetch social accounts' });
  }
});

router.get('/social/accounts/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { data: account, error } = await supabase
      .from('social_accounts')
      .select(ACCOUNT_COLUMNS)
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ ...account, token_status: getTokenStatus(account.token_expires_at) });
  } catch (err) {
    console.error('Error fetching social account:', err);
    res.status(500).json({ error: 'Failed to fetch social account' });
  }
});

router.put('/social/accounts/:id/toggle', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { data: existing, error: fetchError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);

    if (!existing) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const newStatus = !existing.is_active;
    const { error: updateError } = await supabase
      .from('social_accounts')
      .update({ is_active: newStatus })
      .eq('id', req.params.id);
    if (updateError) throw new Error(updateError.message);

    res.json({ id: req.params.id, is_active: newStatus });
  } catch (err) {
    console.error('Error toggling account:', err);
    res.status(500).json({ error: 'Failed to toggle account' });
  }
});

router.delete('/social/accounts/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { data: existing, error: fetchError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);

    if (!existing) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const { error: deleteError } = await supabase.from('social_accounts').delete().eq('id', req.params.id);
    if (deleteError) throw new Error(deleteError.message);
    res.json({ message: 'Account disconnected' });
  } catch (err) {
    console.error('Error disconnecting account:', err);
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
});

function getTokenStatus(expiresAt: string | null): string {
  if (!expiresAt) return 'unknown';
  const expires = new Date(expiresAt);
  const now = new Date();
  const daysLeft = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return 'expired';
  if (daysLeft < 7) return 'expiring_soon';
  return 'active';
}

export default router;

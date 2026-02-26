import { supabase } from '../db/connection';
import { logAudit } from './audit';
import { ContentStatus } from '../types';

const REQUIRED_FB_POSTS = 3;

/**
 * Compute creative-readiness flags for a single content item.
 * Returns the same shape used by the GET /items enrichment logic.
 */
async function getCreativeFlags(itemId: string, productId?: string | null, productTitle?: string | null) {
  let hasHero = false;
  let hasInfographic = false;
  let approvedFbPosts = 0;
  let anyCompletedOutput = false;

  // 1. Check outputs
  const { data: outputs } = await supabase
    .from('content_item_outputs')
    .select('output_type,output_data')
    .eq('content_item_id', itemId);

  for (const o of outputs || []) {
    const status = (o as Record<string, unknown>).output_data
      ? ((o as Record<string, unknown>).output_data as Record<string, unknown>).status
      : undefined;
    if (status && status !== 'completed') continue;

    anyCompletedOutput = true;
    const outputType = (o as Record<string, unknown>).output_type as string;
    if (outputType === 'hero_image' || outputType === 'hero_image_offer') hasHero = true;
    if (outputType === 'infographic_image') hasInfographic = true;
  }

  // 2. Resolve product ID (same fallback logic as GET /items)
  let resolvedProductId = productId || null;
  if (!resolvedProductId && productTitle) {
    const { data: productRows } = await supabase
      .from('products')
      .select('id')
      .ilike('name', productTitle)
      .limit(1);
    if (productRows && productRows.length) {
      resolvedProductId = (productRows[0] as Record<string, unknown>).id as string;
    }
  }

  // 3. Count approved Facebook posts
  if (resolvedProductId) {
    const { data: fbRows } = await supabase
      .from('mock_facebook_posts')
      .select('id')
      .eq('product_id', resolvedProductId)
      .eq('approval_status', 'approved');
    approvedFbPosts = (fbRows || []).length;
  }

  return { hasHero, hasInfographic, approvedFbPosts, anyCompletedOutput };
}

/**
 * Check whether a content item should be auto-transitioned based on its
 * creative outputs, and perform the transition if so.
 *
 * Rules:
 *  - idea  → draft   : when ANY output is created (hero OR infographic)
 *  - draft → review   : when hero + infographic + ≥3 approved FB posts
 *
 * This is fire-and-forget; errors are logged but never thrown so they
 * don't break the calling endpoint.
 */
export async function checkAutoTransition(itemId: string): Promise<void> {
  try {
    const { data: item } = await supabase
      .from('content_items')
      .select('id,status,product_id,product_title')
      .eq('id', itemId)
      .maybeSingle();

    if (!item) return;

    const currentStatus: ContentStatus = (item as Record<string, unknown>).status as ContentStatus;

    // Only auto-transition from idea or draft
    if (currentStatus !== 'idea' && currentStatus !== 'draft') return;

    const flags = await getCreativeFlags(
      itemId,
      (item as Record<string, unknown>).product_id as string | null,
      (item as Record<string, unknown>).product_title as string | null,
    );

    let newStatus: ContentStatus | null = null;

    if (currentStatus === 'idea') {
      // Any completed output created → move to draft
      if (flags.anyCompletedOutput) {
        newStatus = 'draft';
      }
    }

    if (currentStatus === 'draft') {
      // Hero + Infographic + 3 approved FB posts → move to review
      if (flags.hasHero && flags.hasInfographic && flags.approvedFbPosts >= REQUIRED_FB_POSTS) {
        newStatus = 'review';
      }
    }

    // Also check if an item just went from idea straight to meeting review criteria
    // (e.g. batch generation created both outputs at once and FB posts already existed)
    if (currentStatus === 'idea' && flags.hasHero && flags.hasInfographic && flags.approvedFbPosts >= REQUIRED_FB_POSTS) {
      newStatus = 'review';
    }

    if (!newStatus) return;

    // If jumping from idea to review, do it in two steps for audit trail clarity
    if (currentStatus === 'idea' && newStatus === 'review') {
      await supabase.from('content_items').update({ status: 'draft' }).eq('id', itemId);
      await logAudit({
        entityType: 'content_item',
        entityId: itemId,
        action: 'auto_transition',
        actor: 'system',
        actorRole: 'admin',
        details: { from: 'idea', to: 'draft', reason: 'Creative output created' },
      });
    }

    await supabase.from('content_items').update({ status: newStatus }).eq('id', itemId);
    await logAudit({
      entityType: 'content_item',
      entityId: itemId,
      action: 'auto_transition',
      actor: 'system',
      actorRole: 'admin',
      details: {
        from: currentStatus === 'idea' && newStatus === 'review' ? 'draft' : currentStatus,
        to: newStatus,
        reason: newStatus === 'draft'
          ? 'Creative output created'
          : 'Hero, infographic, and 3+ approved Facebook posts complete',
        flags,
      },
    });

    console.log(`[auto-status] ${itemId}: ${currentStatus} → ${newStatus}`);
  } catch (err) {
    // Never throw — this is best-effort
    console.error('[auto-status] Error checking auto-transition:', err);
  }
}

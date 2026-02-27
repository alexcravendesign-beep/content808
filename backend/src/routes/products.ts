import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { checkAutoTransition } from '../services/auto-status';

const router = Router();

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

// Transform localhost URLs to configured Supabase URL
function transformImageUrls(product: Record<string, unknown>): Record<string, unknown> {
  const transformed = { ...product };
  const images = product.images as unknown[] | undefined;
  if (Array.isArray(images)) {
    const fixedImages = images.map((url: unknown) => 
      String(url)
        .replace(/http:\/\/localhost:8000\/storage\/v1\/object\/public\//, 'http://localhost:8000/storage/v1/object/public/')
        .replace(/http:\/\/host\.docker\.internal:8000\/storage\/v1\/object\/public\//, 'http://localhost:8000/storage/v1/object/public/')
    );
    transformed.images = fixedImages;
    // Also set thumbnail for frontend compatibility
    transformed.thumbnail = fixedImages[0] || null;
  }
  return transformed;
}

// GET /products - Search products
router.get('/products', async (req: Request, res: Response) => {
  try {
    const { q, brand, category, limit = '50', offset = '0' } = req.query;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (q) {
      query = query.ilike('name', `%${q}%`);
    }
    if (brand) {
      query = query.eq('brand', String(brand));
    }
    if (category) {
      query = query.eq('category', String(category));
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('Supabase products query error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      total: count || 0,
      limit: Number(limit),
      offset: Number(offset),
      items: (data || []).map(transformImageUrls),
    });
  } catch (err) {
    console.error('Products search error:', err);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

// GET /products/stats - Get stats
router.get('/products/stats', async (_req: Request, res: Response) => {
  try {
    const { count, error } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error('Supabase stats query error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      total: count || 0,
      with_image: 0,
      dna_ready: 0,
      priced: 0,
    });
  } catch (err) {
    console.error('Products stats error:', err);
    res.status(500).json({ error: 'Failed to get product stats' });
  }
});

// GET /products/by-name/:name - Get a single product by exact name
router.get('/products/by-name/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('name', name)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Product not found' });
      }
      console.error('Supabase product by-name query error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(transformImageUrls(data));
  } catch (err) {
    console.error('Product by-name fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch product by name' });
  }
});

// GET /products/:id - Get a single product by ID (must be after all literal /products/... routes)
router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Product not found' });
      }
      console.error('Supabase product query error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(transformImageUrls(data));
  } catch (err) {
    console.error('Product fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// GET /categories - Get category counts
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('category');

    if (error) {
      console.error('Supabase categories query error:', error);
      return res.status(500).json({ error: error.message });
    }

    const counts: Record<string, number> = {};
    data?.forEach((p: { category: string }) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });

    res.json({
      items: Object.entries(counts).map(([category, count]) => ({ category, count })),
    });
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// GET /products/:productId/facebook-posts - Get approved mock Facebook posts for a product
router.get('/products/:productId/facebook-posts', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const requestedLimit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 20);

    // Fetch posts with page data joined via page_id foreign key
    const { data, error } = await supabase
      .from('mock_facebook_posts')
      .select('*, mock_facebook_pages!page_id(name, profile_picture)')
      .eq('product_id', productId)
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(requestedLimit);

    if (error) throw new Error(error.message);

    // Flatten page data into each post record for frontend convenience
    const posts = (data || []).map((row: Record<string, unknown>) => {
      const page = row.mock_facebook_pages as { name?: string; profile_picture?: string } | null;
      const { mock_facebook_pages: _, ...post } = row;
      return {
        ...post,
        page_name: page?.name || null,
        page_profile_picture: page?.profile_picture || null,
      };
    });

    res.json(posts);
  } catch (err) {
    console.error('Error fetching facebook posts for product:', err);
    res.status(500).json({ error: 'Failed to fetch facebook posts' });
  }
});

// GET /products/:productId/review-posts - Get ALL posts for a product (pending, approved, rejected)
router.get('/products/:productId/review-posts', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const requestedLimit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

    const { data, error } = await supabase
      .from('mock_facebook_posts')
      .select('*, mock_facebook_pages!page_id(name, profile_picture)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(requestedLimit);

    if (error) throw new Error(error.message);

    const posts = (data || []).map((row: Record<string, unknown>) => {
      const page = row.mock_facebook_pages as { name?: string; profile_picture?: string } | null;
      const { mock_facebook_pages: _, ...post } = row;
      return {
        ...post,
        page_name: page?.name || null,
        page_profile_picture: page?.profile_picture || null,
      };
    });

    res.json(posts);
  } catch (err) {
    console.error('Error fetching review posts for product:', err);
    res.status(500).json({ error: 'Failed to fetch review posts' });
  }
});

// PATCH /facebook-posts/:postId/approval - Approve or reject a post
router.patch('/facebook-posts/:postId/approval', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { status, approvedBy, notes } = req.body as {
      status: 'approved' | 'rejected' | 'pending';
      approvedBy?: string;
      notes?: string;
    };

    if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be approved, rejected, or pending.' });
    }

    // 1. Validate that the post exists and has a product_id
    const { data: post, error: postError } = await supabase
      .from('mock_facebook_posts')
      .select('id, product_id')
      .eq('id', postId)
      .maybeSingle();

    if (postError) throw new Error(postError.message);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const productId = (post as Record<string, unknown>).product_id as string | null;
    if (!productId) {
      return res.status(400).json({ error: 'Post has no associated product' });
    }

    // 2. Insert approval record into mock_facebook_approvals
    const { error: approvalError } = await supabase
      .from('mock_facebook_approvals')
      .insert({
        post_id: postId,
        status,
        approved_by: approvedBy || 'content808-reviewer',
        notes: notes || null,
      });

    if (approvalError) throw new Error(approvalError.message);

    // 3. Update the post's approval_status
    const { error: updateError } = await supabase
      .from('mock_facebook_posts')
      .update({ approval_status: status })
      .eq('id', postId);

    if (updateError) throw new Error(updateError.message);

    // 4. Find the content_item associated with this product and trigger auto-transition
    // Try by product_id column first, then fall back to product_title match
    const { data: contentItems } = await supabase
      .from('content_items')
      .select('id')
      .eq('product_id', productId)
      .limit(1);

    let contentItemId: string | null = null;
    if (contentItems && contentItems.length > 0) {
      contentItemId = (contentItems[0] as Record<string, unknown>).id as string;
    } else {
      // Fallback: find by product name matching product_title
      const { data: productRow } = await supabase
        .from('products')
        .select('name')
        .eq('id', productId)
        .maybeSingle();

      if (productRow) {
        const productName = (productRow as Record<string, unknown>).name as string;
        const { data: itemsByTitle } = await supabase
          .from('content_items')
          .select('id')
          .ilike('product_title', productName)
          .limit(1);

        if (itemsByTitle && itemsByTitle.length > 0) {
          contentItemId = (itemsByTitle[0] as Record<string, unknown>).id as string;
        }
      }
    }

    if (contentItemId) {
      await checkAutoTransition(contentItemId);
    }

    res.json({ message: `Post ${status} successfully`, postId, status });
  } catch (err) {
    console.error('Error updating post approval:', err);
    res.status(500).json({ error: 'Failed to update post approval' });
  }
});

export default router;

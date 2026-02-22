import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

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

export default router;

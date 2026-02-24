const BASE = '/product-api/api/v1';

/* ── Types ── */

/**
 * Product Intel may emit specs as:
 *   { name, terms: string[] }   — multi-value spec
 *   { name, value: string }     — single-value spec
 */
export interface TechnicalSpec {
    name: string;
    terms?: string[];
    value?: string;
}

/**
 * Product Intel may emit angles as:
 *   string                      — plain text
 *   { title, content }          — structured angle
 */
export interface MarketingAngle {
    title: string;
    content: string;
}

export interface Product {
    id: string;
    name: string;
    brand: string;
    category: string;
    selling_price: string | null;
    price_point: string | null;
    description: string | null;
    usp: string | null;
    visual_style: string | null;

    features: string[];
    benefits: string[];
    pain_points: string[];
    target_audience: string[];
    marketing_angles: (string | MarketingAngle)[];
    competitors: string[];

    technical_specs: (string | TechnicalSpec)[];
    annual_energy_consumption: string | null;

    thumbnail: string | null;
    source_url: string | null;

    infographic_prompt: string | null;
    infographic_url: string | null;
    infographic_status: string | null;
}

export interface ProductSearchParams {
    q?: string;
    brand?: string;
    category?: string;
    limit?: number;
    offset?: number;
}

export interface ProductSearchResult {
    total: number;
    limit: number;
    offset: number;
    items: Product[];
}

export interface ProductStats {
    total: number;
    with_image: number;
    dna_ready: number;
    priced: number;
}

export interface CategoryItem {
    category: string;
    count: number;
}

/* ── API calls ── */

async function request<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Product API request failed: ${res.status}`);
    }
    return res.json();
}

export interface MockFacebookPostRecord {
    id: string;
    page_id: string;
    product_id: string;
    content: string;
    image?: string;
    likes: number;
    comments: number;
    shares: number;
    approval_status: string;
    post_comments: string;
    created_at: string;
    updated_at: string;
}

export const productApi = {
    searchProducts: (params: ProductSearchParams = {}) => {
        const qs = new URLSearchParams();
        if (params.q) qs.set('q', params.q);
        if (params.brand) qs.set('brand', params.brand);
        if (params.category) qs.set('category', params.category);
        qs.set('limit', String(params.limit ?? 50));
        qs.set('offset', String(params.offset ?? 0));
        return request<ProductSearchResult>(`/products?${qs.toString()}`);
    },

    getStats: () => request<ProductStats>('/products/stats'),

    getCategories: () => request<{ items: CategoryItem[] }>('/categories'),

    getFacebookPosts: (productId: string) =>
        request<MockFacebookPostRecord[]>(`/products/${productId}/facebook-posts`),
};

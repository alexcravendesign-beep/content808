const BASE = '/product-api/api/v1';

/* ── Types ── */

export interface Product {
    id: string;
    name: string;
    brand: string;
    category: string;
    selling_price: string | null;
    rrp_price: string | null;
    currency: string;
    price_source: string | null;
    source_url: string | null;
    thumbnail: string | null;
    dna_confidence: string | null;
    features: string[];
    marketing_angles: string[];
    technical_specs: string[];
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
};

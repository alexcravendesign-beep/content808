const API_URL = import.meta.env.VITE_API_URL || '';
const BASE = `${API_URL}/api/v1/content-hub`;

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

const defaultHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'x-user-id': 'staff-user-1',
  'x-user-name': 'Staff User',
  'x-user-role': 'admin',
};

export function setUserHeaders(id: string, name: string, role: string) {
  defaultHeaders['x-user-id'] = id;
  defaultHeaders['x-user-name'] = name;
  defaultHeaders['x-user-role'] = role;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...defaultHeaders, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getItems: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ items: ContentItem[]; total: number }>(`/items${qs}`);
  },
  getItem: (id: string) => request<ContentItem & { valid_transitions: string[] }>(`/items/${id}`),
  createItem: (data: Partial<ContentItem>) => request<ContentItem>('/items', { method: 'POST', body: data }),
  updateItem: (id: string, data: Partial<ContentItem>) => request<ContentItem>(`/items/${id}`, { method: 'PUT', body: data }),
  deleteItem: (id: string) => request<{ message: string }>(`/items/${id}`, { method: 'DELETE' }),
  transitionItem: (id: string, to: string, reason?: string) =>
    request<ContentItem>(`/items/${id}/transition`, { method: 'POST', body: { to, reason } }),

  getApprovals: () => request<{ items: ContentItem[]; total: number }>('/approvals'),
  approveItem: (id: string) => request<ContentItem>(`/approvals/${id}/approve`, { method: 'POST' }),
  blockItem: (id: string, reason: string) =>
    request<ContentItem>(`/approvals/${id}/block`, { method: 'POST', body: { reason } }),

  getCalendar: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ items: ContentItem[] }>(`/calendar${qs}`);
  },
  rescheduleItem: (id: string, data: { publish_date?: string; due_date?: string }) =>
    request<ContentItem>(`/calendar/${id}/reschedule`, { method: 'PUT', body: data }),

  // Calendar Notes
  getCalendarNotes: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ notes: CalendarNote[] }>(`/calendar/notes${qs}`);
  },
  createCalendarNote: (data: { date: string; note: string; color?: string; visibility?: string }) =>
    request<CalendarNote>('/calendar/notes', { method: 'POST', body: data }),
  updateCalendarNote: (id: string, data: Partial<{ note: string; color: string; visibility: string; date: string }>) =>
    request<CalendarNote>(`/calendar/notes/${id}`, { method: 'PUT', body: data }),
  deleteCalendarNote: (id: string) =>
    request<{ message: string }>(`/calendar/notes/${id}`, { method: 'DELETE' }),

  getComments: (itemId: string) => request<{ comments: ContentComment[] }>(`/items/${itemId}/comments`),
  addComment: (itemId: string, body: string) =>
    request<ContentComment>(`/items/${itemId}/comments`, { method: 'POST', body: { body } }),

  getOutputs: (itemId: string) => request<{ outputs: ContentItemOutput[] }>(`/items/${itemId}/outputs`),
  addOutput: (itemId: string, output_type: string, output_data: Record<string, unknown>) =>
    request<ContentItemOutput>(`/items/${itemId}/outputs`, { method: 'POST', body: { output_type, output_data } }),

  getHistory: (itemId: string) => request<{ history: AuditEntry[] }>(`/items/${itemId}/history`),
  getStats: () => request<Stats>('/stats'),

  getPlugins: () => request<{ plugins: Plugin[] }>('/plugins'),
  updatePlugin: (id: string, data: Partial<Plugin>) =>
    request<Plugin>(`/plugins/${id}`, { method: 'PUT', body: data }),

  getActivity: (limit = 100) => request<{ entries: AuditEntry[] }>(`/audit?limit=${limit}`),

  getProductOutputs: (productId: string) =>
    request<{ outputs: ContentItemOutput[]; assets: ProductAsset[] }>(`/products/${productId}/outputs`),
  uploadProductAsset: async (productId: string, file: File, label?: string, assetType?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (label) formData.append('label', label);
    if (assetType) formData.append('asset_type', assetType);
    const res = await fetch(`${BASE}/products/${productId}/upload-asset`, {
      method: 'POST',
      headers: {
        'x-user-id': defaultHeaders['x-user-id'],
        'x-user-name': defaultHeaders['x-user-name'],
        'x-user-role': defaultHeaders['x-user-role'],
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<ProductAsset>;
  },

  agentFill: (id: string) => request<{ jobId: string }>(`/items/${id}/agent-fill`, { method: 'POST' }),
  syncProductAssets: (id: string) => request<{ ok: boolean; created: number; product_name: string }>(`/items/${id}/sync-product-assets`, { method: 'POST' }),
  syncProductAssetsBatch: (item_ids: string[]) => request<{ ok: boolean; processed: number; okCount: number; createdTotal: number }>(`/items/sync-product-assets-batch`, { method: 'POST', body: { item_ids } }),
  generateInfographic: (id: string) => request<{ ok: boolean; mode: string; url: string; product_name: string }>(`/items/${id}/generate-infographic`, { method: 'POST' }),
  generateHero: (id: string) => request<{ ok: boolean; mode: string; url: string; product_name: string }>(`/items/${id}/generate-hero`, { method: 'POST' }),
  generateHeroOffer: (id: string) => request<{ ok: boolean; mode: string; url: string; product_name: string; price: string; finance_applied: boolean }>(`/items/${id}/generate-hero-offer`, { method: 'POST' }),
  generateBoth: (id: string) => request<{ ok: boolean; infographic: unknown; hero: unknown }>(`/items/${id}/generate-both`, { method: 'POST' }),
  generateBatch: (item_ids: string[], mode: 'infographic'|'hero'|'both') => request<{ ok: boolean; queued: boolean; jobId: string }>(`/items/generate-batch`, { method: 'POST', body: { item_ids, mode } }),
  getGenerateBatchStatus: (jobId: string) => request<{ state: string; progress?: { processed: number; total: number; okCount: number }; ok?: boolean; processed?: number; okCount?: number; error?: string }>(`/items/generate-batch/${jobId}`),
};

export interface ContentItem {
  id: string;
  brand: string;
  product_url: string;
  product_title: string;
  product_image_url: string;
  product_id: string | null;
  campaign_goal: string | Record<string, unknown> | null;
  direction: string | Record<string, unknown> | null;
  target_audience: string[] | null;
  pivot_notes: string;
  platform: string;
  status: string;
  due_date: string | null;
  publish_date: string | null;
  assignee: string | null;
  final_copy: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  valid_transitions?: string[];
  has_hero?: boolean;
  has_infographic?: boolean;
  creative_done?: boolean;
  has_facebook_approved?: boolean;
  approved_facebook_posts?: number;
}

export interface ContentComment {
  id: string;
  content_item_id: string;
  user_id: string;
  user_name: string;
  body: string;
  created_at: string;
}

export interface ContentItemOutput {
  id: string;
  content_item_id: string;
  output_type: string;
  output_data: Record<string, unknown>;
  created_by?: string;
  created_at: string;
}

export interface ProductAsset {
  id: string;
  product_id: string;
  asset_type: string;
  url: string;
  label: string;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  actor_role: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Stats {
  total: number;
  by_status: Record<string, number>;
  due_soon: number;
  scheduled_today: number;
}

export interface CalendarNote {
  id: string;
  date: string;
  note: string;
  color: string | null;
  visibility: 'private' | 'team';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown>;
  mount_point: string;
  created_at: string;
  updated_at: string;
}

export type ContentStatus =
  | 'idea'
  | 'draft'
  | 'review'
  | 'approved'
  | 'blocked'
  | 'scheduled'
  | 'published';

export type UserRole = 'staff' | 'manager' | 'admin';

export type PluginType = 'panel' | 'widget' | 'action';

export interface ContentItem {
  id: string;
  brand: string;
  product_url: string;
  campaign_goal: string;
  direction: string;
  pivot_notes: string;
  platform: string;
  status: ContentStatus;
  due_date: string | null;
  publish_date: string | null;
  assignee: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
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
  created_at: string;
}

export interface PluginRegistryEntry {
  id: string;
  name: string;
  description: string;
  type: PluginType;
  enabled: boolean;
  config: Record<string, unknown>;
  mount_point: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  actor_role: UserRole;
  details: Record<string, unknown>;
  created_at: string;
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

export interface RequestUser {
  id: string;
  name: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

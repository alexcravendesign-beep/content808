# API Documentation

Base URL: `/api/v1/content-hub`

All requests require auth headers:
- `x-user-id` — User ID
- `x-user-name` — Display name
- `x-user-role` — One of: `staff`, `manager`, `admin`

## Health

### GET /health
Returns server health status.
```json
{ "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z" }
```

### GET /ready
Returns readiness including DB connection status.
```json
{ "status": "ready", "db": "connected", "timestamp": "2024-01-01T00:00:00.000Z" }
```

## Content Items

### GET /api/v1/content-hub/items
List all content items. Supports query filters:
- `status` — Filter by status
- `platform` — Filter by platform
- `assignee` — Filter by assignee
- `brand` — Fuzzy search by brand
- `search` — Search across brand, campaign_goal, direction

**Response:**
```json
{
  "items": [{ "id": "uuid", "brand": "...", "status": "idea", ... }],
  "total": 10
}
```

### GET /api/v1/content-hub/items/:id
Get single item with valid transitions.
```json
{
  "id": "uuid",
  "brand": "BrandX",
  "status": "draft",
  "valid_transitions": ["review"],
  ...
}
```

### POST /api/v1/content-hub/items
Create new item (starts as `idea`).
```json
{
  "brand": "BrandX",
  "campaign_goal": "Increase engagement",
  "direction": "Lifestyle content",
  "pivot_notes": "",
  "product_url": "https://example.com",
  "platform": "instagram",
  "due_date": "2024-02-01T00:00:00Z",
  "publish_date": null,
  "assignee": "john"
}
```

### PUT /api/v1/content-hub/items/:id
Update item fields (does not change status).

### DELETE /api/v1/content-hub/items/:id
Delete item. **Requires `admin` role.**

## Transitions

### POST /api/v1/content-hub/items/:id/transition
Transition item to a new status.
```json
{ "to": "review", "reason": "Ready for review" }
```

Valid transitions (enforced server-side):
| From       | To                      | Roles                    |
|------------|-------------------------|--------------------------|
| idea       | draft                   | staff, manager, admin    |
| draft      | review                  | staff, manager, admin    |
| review     | approved, blocked       | manager, admin           |
| blocked    | draft, review           | staff, manager, admin    |
| approved   | scheduled, blocked      | manager, admin           |
| scheduled  | published, blocked      | manager, admin           |

**Error (422):**
```json
{
  "error": "Cannot transition from 'idea' to 'published'",
  "valid_transitions": ["draft"]
}
```

## Approvals

### GET /api/v1/content-hub/approvals
List items in `review` status.

### POST /api/v1/content-hub/approvals/:id/approve
Approve an item (moves to `approved`). **Requires `manager` or `admin`.**

### POST /api/v1/content-hub/approvals/:id/block
Block an item with reason. **Requires `manager` or `admin`.**
```json
{ "reason": "Missing product link" }
```

## Calendar

### GET /api/v1/content-hub/calendar
Get items with dates for calendar view.
- `start` — ISO date range start
- `end` — ISO date range end
- `platform`, `status`, `assignee` — Optional filters

### PUT /api/v1/content-hub/calendar/:id/reschedule
Update publish_date and/or due_date.
```json
{ "publish_date": "2024-02-15T10:00:00Z" }
```

## Comments

### GET /api/v1/content-hub/items/:id/comments
List comments for an item.

### POST /api/v1/content-hub/items/:id/comments
Add a comment.
```json
{ "body": "Looks good, one minor edit needed" }
```

## Outputs

### GET /api/v1/content-hub/items/:id/outputs
List generated outputs for an item.

### POST /api/v1/content-hub/items/:id/outputs
Add an output.
```json
{ "output_type": "caption", "output_data": { "text": "...", "hashtags": [] } }
```

## History

### GET /api/v1/content-hub/items/:id/history
Get audit trail for an item.

## Stats

### GET /api/v1/content-hub/stats
Get KPI statistics.
```json
{
  "total": 25,
  "by_status": { "idea": 5, "draft": 8, "review": 3, ... },
  "due_soon": 4,
  "scheduled_today": 2
}
```

## Plugins

### GET /api/v1/content-hub/plugins
List all registered plugins.

### GET /api/v1/content-hub/plugins/:id
Get single plugin.

### POST /api/v1/content-hub/plugins
Register a new plugin. **Requires `admin`.**
```json
{
  "name": "AI Caption Generator",
  "description": "Generates captions using AI",
  "type": "action",
  "config": {},
  "mount_point": "item-detail-actions"
}
```

### PUT /api/v1/content-hub/plugins/:id
Update plugin (enable/disable, config). **Requires `admin`.**
```json
{ "enabled": true }
```

## Audit Log

### GET /api/v1/content-hub/audit
Get recent audit log entries. **Requires `manager` or `admin`.**
- `limit` — Max entries (default: 50, max: 200)

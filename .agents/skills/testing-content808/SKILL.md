# Testing content808 (Craven Content Hub)

## Overview
This is a full-stack content management application with a React (Vite) frontend and Express/TypeScript backend backed by Supabase (PostgreSQL) and Redis.

## Devin Secrets Needed
- `SUPABASE_URL` — Supabase instance URL (e.g. `https://supabase.cravencooling.services`)
- `SUPABASE_ANON_KEY_` — Supabase anonymous key for API auth

## Environment Setup

### Backend
```bash
cd /home/ubuntu/repos/content808/backend
npm install
SUPABASE_URL="${SUPABASE_URL}" SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY_}" REDIS_HOST=localhost REDIS_PORT=6379 CORS_ORIGIN="*" PORT=4000 npx ts-node-dev --respawn --transpile-only src/index.ts
```
Backend runs on `http://localhost:4000`. API base: `/api/v1/content-hub`.

Note: Redis must be running locally (`redis-server`). Install with `sudo apt-get install -y redis-server` if needed, then start with `sudo service redis-server start`.

### Frontend
```bash
cd /home/ubuntu/repos/content808/frontend
npm install
npx vite --host 0.0.0.0 --port 5173
```
Frontend runs on `http://localhost:5173`.

The frontend proxies API calls to the backend via Vite config — no manual proxy setup needed.

## Key Pages & Navigation

The sidebar navigation (defined in `frontend/src/components/Layout.tsx`) has these routes:
- **Kanban** → `/`
- **Calendar** → `/calendar`
- **Approvals** → `/approvals`
- **Activity** → `/activity`
- **Media Library** → `/social/media`
- **Settings** → `/settings`

## Testing Features

### Split to Posts (Calendar Day View)
1. Navigate to Calendar → switch to Day view
2. Find an item with status "approved" or "published"
3. Click the item to open the popover → "Split to Posts" button appears
4. Click "Split to Posts" → 3 child cards appear under the parent
5. Children are draggable to different hour slots
6. "Undo Split" button appears on the parent's popover to reverse the split

**Important:** Split operates on the live database. Always undo splits after testing to clean up.

### Approvals Page Facebook Posts
1. Navigate to `/approvals`
2. Wait for items to load (may take a few seconds to fetch FB posts per item)
3. Cards with products that have Facebook posts show a "Facebook Posts (N)" toggle
4. Click to expand → shows FB post cards in a responsive grid with content, images, engagement stats
5. Click again to collapse

### Product API
The product API is at `/product-api/api/v1`. Key endpoints:
- `GET /products/by-name/:name` — look up product by name (used by both split and approvals)
- `GET /products/:id/facebook-posts` — get Facebook posts for a product

## TypeScript Checks
```bash
# Frontend
cd frontend && npx tsc --noEmit

# Backend
cd backend && npx tsc --noEmit
```

## Common Issues
- **Backend fails to start:** Check that Redis is running and Supabase credentials are correct
- **No FB posts on approval cards:** Product name matching uses `ilike` — if `product_title` doesn't match `products.name` in the DB, no posts are fetched. This is a known fragility.
- **Frontend shows 0 items then loads:** The approvals page has a brief loading state with skeleton loaders — wait a few seconds for data to arrive
- **Vite proxy errors:** Make sure backend is running before starting frontend

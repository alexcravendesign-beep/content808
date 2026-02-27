# Testing Content Hub Frontend

## Overview
The Content Hub is a React + Vite frontend with an Express/Node backend. The frontend can be tested independently for UI-only changes, but features like the Post Review panel require the backend to be running.

## Frontend Setup
- Directory: `frontend/`
- Dev server: `npm run dev` (Vite, runs on http://localhost:5173)
- Build: `npm run build` (runs `tsc -b && vite build`)
- Lint: `npm run lint` (ESLint)
- TypeScript check: `npx tsc --noEmit` in `frontend/`
- Node modules are typically pre-installed; if not, run `npm install` in `frontend/`

## Backend Setup
- Directory: `backend/`
- Requires Supabase (external, URL in .env), Redis (optional, non-critical)
- Dev server: `npm run dev` (ts-node-dev, runs on port 4000)
- The backend is NOT needed for frontend-only UI testing — API calls fail gracefully with toast errors, and all UI components still render with empty data
- Redis connection errors in backend logs are non-critical (only affects worker queue)
- Backend may log "migration" errors if PostgreSQL is unreachable — this is expected for external Supabase setups

## Route Structure
- `/` — Kanban board
- `/calendar` — Calendar page (Month/Week/Day/Agenda views)
- `/approvals` — Approvals page
- `/item/:id` — Item detail page
- `/item/:id/content` — Content page (shows outputs, post review panel)
- `/activity` — Activity log
- `/settings` — Settings page
- `/social/compose` — Post composer
- `/social/queue` — Post queue
- `/social/media` — Media library
- `/social/analytics` — Analytics
- `/social/accounts` — Social accounts

## Testing Frontend-Only Changes
1. Start the frontend dev server: `npm run dev` in `frontend/`
2. Navigate to the relevant page (e.g., `http://localhost:5173/calendar`)
3. API calls will fail with toast notifications ("Failed to load calendar") — this is expected without the backend
4. All UI components, interactions, dropdowns, modals, and navigation still work
5. URL parameters update correctly (e.g., `?month=2026-02&view=month`)

## Testing Full-Stack Features (Post Review, Comments, Status Control)
1. Start BOTH backend (`npm run dev` in `backend/`) and frontend (`npm run dev` in `frontend/`)
2. The backend needs Supabase credentials in `backend/.env` (SUPABASE_URL and SUPABASE_ANON_KEY)
3. Auth is hardcoded in the frontend — no login needed (headers: x-user-id: staff-user-1, x-user-role: admin)
4. To test the Post Review panel:
   - Navigate to `/item/:id/content` for a content item that has associated mock facebook posts
   - Find content items via the Kanban board (`/`) — look for items in "review" or "draft" status
   - The Post Review section appears under "Outputs" and shows posts with status badges
5. To find test data, query Supabase for products with mock_facebook_posts, then find content_items linked to those products

## Testing Post Review Panel
- **Status badges**: Posts show colored badges (green=approved, red=rejected, amber=pending)
- **Status control buttons**: Each post shows contextual buttons based on current status:
  - Approved posts: Reject, Back to Queue
  - Rejected posts: Approve, Back to Queue
  - Pending posts: Approve, Reject
- **Comments**: Click "Add comment" or "N comments" to expand the comments thread
  - Type in the input field and press Enter or click the send button
  - Comments show author name and timestamp
  - Comments persist in Supabase `mock_facebook_comments` table
  - Existing comments from Mock Facebook are backward-compatible and will display
- **Page load timing**: The ContentPage may take a few seconds to load posts because it first searches for the product by title, then fetches posts. Wait 3-5 seconds after navigation before checking content.

## Key Testing Notes
- The calendar page supports URL params: `?month=YYYY-MM&view=month|week|day|agenda`
- Click-outside handlers on dropdowns/popups may have race conditions with toggle buttons — test open/close via both the toggle button and clicking outside
- The app uses a custom theme system with light/dark/system modes — check the theme toggle in the sidebar footer
- Toast notifications auto-dismiss after a few seconds
- Clicking on empty calendar cells opens the "Create New Item" modal
- Status changes trigger a full refresh of posts from the API, so the UI should update immediately
- The "Back to Queue" button sets status to "pending" — this is the mechanism for sending posts back into the review queue

## Devin Secrets Needed
No secrets are needed for frontend-only testing. The backend requires:
- `SUPABASE_URL` — URL of the Supabase instance (stored in `backend/.env`)
- `SUPABASE_ANON_KEY` — Supabase anonymous key (stored in `backend/.env`)
- Redis credentials are optional (only for background worker functionality)

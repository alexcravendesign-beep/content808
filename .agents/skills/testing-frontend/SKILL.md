# Testing Content Hub Frontend

## Overview
The Content Hub is a React + Vite frontend with an Express/Node backend. The frontend can be tested independently for UI-only changes.

## Frontend Setup
- Directory: `frontend/`
- Dev server: `npm run dev` (Vite, runs on http://localhost:5173)
- Build: `npm run build` (runs `tsc -b && vite build`)
- Lint: `npm run lint` (ESLint)
- TypeScript check: `npx tsc --noEmit` in `frontend/`
- Node modules are typically pre-installed; if not, run `npm install` in `frontend/`

## Backend Setup
- Directory: `backend/`
- Requires PostgreSQL (Supabase), Redis, and environment variables in `backend/.env`
- Dev server: `npm run dev` (ts-node-dev, runs on port 4000)
- The backend is NOT needed for frontend-only UI testing — API calls fail gracefully with toast errors, and all UI components still render with empty data

## Route Structure
- `/` — Kanban board
- `/calendar` — Calendar page (Month/Week/Day/Agenda views)
- `/approvals` — Approvals page
- `/item/:id` — Item detail page
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

## Key Testing Notes
- The calendar page supports URL params: `?month=YYYY-MM&view=month|week|day|agenda`
- Click-outside handlers on dropdowns/popups may have race conditions with toggle buttons — test open/close via both the toggle button and clicking outside
- The app uses a custom theme system with light/dark/system modes — check the theme toggle in the sidebar footer
- Toast notifications auto-dismiss after a few seconds
- Clicking on empty calendar cells opens the "Create New Item" modal

## Devin Secrets Needed
No secrets are needed for frontend-only testing. The backend requires database credentials stored in `backend/.env`.

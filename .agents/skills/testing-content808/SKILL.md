# Testing content808 - ContentPage & Post Review Panel

## Devin Secrets Needed
- No special secrets required. The app connects to a Supabase instance configured in `.env` files.

## Local Setup

### Backend (port 4000)
```bash
cd backend && npm install && npm run dev
```
The backend runs on `http://localhost:4000`. Health check: `curl http://localhost:4000/api/health`

### Frontend (port 5173)
```bash
cd frontend && npm install && npm run dev
```
The frontend runs on `http://localhost:5173`.

## Navigation

### Content Pages
Content pages are accessed via `/item/{itemId}/content`. Key test items:
- **ISA Isabella 10LX (Fridgesmart)**: `/item/b45a22a4-9bfb-4ad5-92e5-a437c0427e89/content` — has 7+ posts, good for testing grid layout
- **Elcold Focus 151**: `/item/1b8e7f0c-310c-422a-931d-bf96c5311492/content` — has infographic/hero images and fewer posts

You can also navigate from the Kanban board (`/`) by clicking an item card, then clicking the "Content" tab.

### Other Key Pages
- Kanban board: `/`
- Approvals: `/approvals`
- Media Library: `/social/media`

## Testing the Post Review Panel

### Grid Layout
- Posts display in a responsive grid: 1 column on mobile, 2 on sm, 3 on lg
- Media images display in a separate grid: 2→3→4→5 columns
- The page container is `max-w-7xl` to accommodate the wider grid

### Post Cards
Each post card has:
- Thumbnail image (4:3 aspect ratio) with status badge overlay
- Truncated text (3 lines) with "Show more/less" toggle
- Action buttons: Reject, Queue (for approved posts), Approve (for rejected/pending)
- Comment toggle button showing count

### Accordion Behavior
- Only one post's text can be expanded at a time (`expandedPostId` state)
- Comment sections can have multiple open simultaneously (`expandedComments` state)

### Comments
- Click the "Comment" button to expand the comment section
- Type in the input field and press Enter to submit
- The comment count badge updates immediately after adding (no page refresh needed)
- Comments show author name and timestamp

### Status Changes
- Approved posts show: Reject + Queue buttons
- Rejected posts show: Approve + Queue buttons  
- Pending posts show: Approve + Reject buttons
- "Queue" sends a post back to pending status
- Status changes trigger `checkAutoTransition` which may move the content item from draft→review

### Media Grid
- Hero and infographic images display in a media library-style grid
- Hover over images to see Copy URL and Delete action buttons
- Type badges appear on images (e.g., "hero image", "infographic image")

## Common Issues
- If posts don't load, check that the backend is running and the product has a valid `product_id` linked to posts in `mock_facebook_posts`
- The `line-clamp-3` Tailwind utility might not work if the Tailwind config doesn't include the line-clamp plugin — check `tailwind.config.js` if text truncation isn't working
- Hover overlays on the media grid won't work on touch devices — this is a known limitation

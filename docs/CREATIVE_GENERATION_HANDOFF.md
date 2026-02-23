# Content808 Handoff PR — Per-item + Batch Creative Generation

## Why
Current system can sync existing assets into Outputs, but cannot yet generate fresh creative directly from item actions.

## Goal (must ship)
Implement end-to-end **working** generation in Content808 for:
1. Generate Infographic
2. Generate Hero
3. Generate Both

At both levels:
- per-item action
- batch action

## Non-negotiables
- No placeholder buttons.
- Every run must persist:
  - prompt used
  - output URL
  - status (`pending|processing|completed|failed`)
  - error details (if failed)
- Outputs tab must show generated images inline.

## Existing baseline already in main
- Item-level **Sync Product Assets** works.
- Calendar-level **Sync Visible Assets** works.
- Outputs tab already renders image previews when output_data.url exists.

## Required backend changes
### New endpoints
- `POST /api/v1/content-hub/items/:id/generate-infographic`
- `POST /api/v1/content-hub/items/:id/generate-hero`
- `POST /api/v1/content-hub/items/:id/generate-both`
- `POST /api/v1/content-hub/items/generate-batch` with body:
  - `item_ids: string[]`
  - `mode: "infographic" | "hero" | "both"`

### Behavior
- Lookup item -> resolve product (name/brand fallback).
- Build prompt for selected mode.
- Run image generation (Nano Banana Pro flow already proven).
- Upload output to storage bucket.
- Insert `content_item_outputs` row(s):
  - `output_type`: `infographic_image` / `hero_image`
  - `output_data`: `{ url, prompt, product_name, mode }`
- Return created output metadata.

## Prompt / generation rules
### Infographic mode
- Use Nick’s adapted infographic prompt template (already defined in automations).
- Feed brand template + logo + product context.

### Hero mode
- Use branded story hero prompt:
  - preserve logo/background
  - product in lower half
  - product name at bottom
  - 9:16 portrait

### Both mode
- Generate infographic first, then hero.
- If first fails, return partial + failure details.

## UI requirements
### Item detail page
Add 3 action buttons:
- Generate Infographic
- Generate Hero
- Generate Both

Show loading state per action and success/failure toast.

### Calendar page
Add batch action controls for visible/selected items:
- Generate Infographic (batch)
- Generate Hero (batch)
- Generate Both (batch)

## Acceptance criteria
- Clicking item button generates real image and appears in Outputs tab without refresh bugs.
- Prompt text is persisted and visible via output payload.
- Batch endpoint processes multiple IDs and returns per-item result list.
- At least one manual test proof in PR description with item id + output URL.

## Out of scope (for next PR)
- Caption/copywriting generation and hashtag packs.
- Auto-publish posting flows.

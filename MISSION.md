# MISSION.md — Content808 Creative Generation Lock-In

## Objective
Implement **phase 1** safely:
- Per-item generation controls for:
  1) Infographic
  2) Story Hero
  3) Both
- Persist prompts + output URLs + statuses on each content item.

## Scope (Phase 1 only)
- Add DB fields for infographic/hero prompt+url+status+error.
- Add backend endpoints to queue/run generation for a single item.
- Add UI buttons on item page/modal for per-item execution.
- Save prompt text to database every run.

## Non-Negotiable Guardrails
1. Do not auto-run all items by default.
2. No hidden background mass generation without explicit user action.
3. Keep existing content/calendar behavior intact.
4. On errors: mark failed with message, never silently swallow.
5. Preserve current Fridgesmart prompt and hero method.

## Execution Rules
- Per-item runs require explicit click.
- "Generate Both" runs infographic first, then hero.
- If infographic fails, hero may still run only if explicitly allowed in request.
- Every run writes an audit note (who/when/what).

## Data Contract (minimum)
Per content item:
- `infographic_prompt`
- `infographic_url`
- `infographic_status` (pending|processing|completed|failed)
- `infographic_error`
- `hero_prompt`
- `hero_url`
- `hero_status` (pending|processing|completed|failed)
- `hero_error`

## Safety Stop
If output quality drifts or workload explodes:
- switch generation to manual-only
- disable "batch" actions until reviewed
- notify Boss before resuming

## Success Criteria (Phase 1)
- User can open one item and generate infographic/hero from UI.
- Prompts and image URLs are saved on that item.
- Statuses are visible and accurate.
- No surprise bulk jobs fired.

---
Owner: Nick
Operator: Alex Craven V3
Status: Begin Phase 1 implementation now.

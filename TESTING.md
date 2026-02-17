# Testing Guide

## Prerequisites

Ensure services are running:
```bash
docker compose up -d --build
```

## Health Checks

```bash
# Server health
curl http://localhost:4000/health
# Expected: {"status":"ok","timestamp":"..."}

# Database readiness
curl http://localhost:4000/ready
# Expected: {"status":"ready","db":"connected","timestamp":"..."}
```

## E2E Smoke Test

Run the full lifecycle test:

```bash
API=http://localhost:4000/api/v1/content-hub
HEADERS='-H "Content-Type: application/json" -H "x-user-id: test-user" -H "x-user-name: Test User" -H "x-user-role: admin"'

# 1. Create item
ITEM=$(curl -s -X POST $API/items \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user" \
  -H "x-user-name: Test User" \
  -H "x-user-role: admin" \
  -d '{"brand":"Smoke Test Brand","campaign_goal":"Test lifecycle","platform":"instagram"}')
echo "Created: $ITEM"
ID=$(echo $ITEM | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# 2. Transition: idea → draft
curl -s -X POST $API/items/$ID/transition \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user" -H "x-user-name: Test User" -H "x-user-role: admin" \
  -d '{"to":"draft"}'

# 3. Transition: draft → review
curl -s -X POST $API/items/$ID/transition \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user" -H "x-user-name: Test User" -H "x-user-role: admin" \
  -d '{"to":"review"}'

# 4. Approve
curl -s -X POST $API/approvals/$ID/approve \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user" -H "x-user-name: Test User" -H "x-user-role: admin"

# 5. Transition: approved → scheduled
curl -s -X POST $API/items/$ID/transition \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user" -H "x-user-name: Test User" -H "x-user-role: admin" \
  -d '{"to":"scheduled"}'

# 6. Transition: scheduled → published
curl -s -X POST $API/items/$ID/transition \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user" -H "x-user-name: Test User" -H "x-user-role: admin" \
  -d '{"to":"published"}'

# 7. Verify full history
curl -s $API/items/$ID/history \
  -H "x-user-id: test-user" -H "x-user-name: Test User" -H "x-user-role: admin" | python3 -m json.tool

# 8. Add comment
curl -s -X POST $API/items/$ID/comments \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user" -H "x-user-name: Test User" -H "x-user-role: admin" \
  -d '{"body":"Smoke test comment"}'

# 9. Check stats
curl -s $API/stats \
  -H "x-user-id: test-user" -H "x-user-name: Test User" -H "x-user-role: admin" | python3 -m json.tool

# 10. Check audit log
curl -s "$API/audit?limit=10" \
  -H "x-user-id: test-user" -H "x-user-name: Test User" -H "x-user-role: admin" | python3 -m json.tool
```

## Frontend Verification

1. Open http://localhost:3000
2. **Kanban Board**: Verify 7 lanes visible (idea through published)
3. **Create Item**: Click "New Item", fill form, submit
4. **Drag & Drop**: Drag card between lanes — verify transition succeeds or shows error for invalid transitions
5. **Calendar**: Navigate to Calendar tab, verify month/week views, drag items between dates
6. **Approvals**: Move item to "review", navigate to Approvals tab, approve or block
7. **Item Detail**: Click any card to view detail page, add comment, verify activity history
8. **KPI Strip**: Verify counts update after actions

## CI Checks

The GitHub Actions workflow runs:
- Backend: `npm run lint` + `npm test`
- Frontend: `npm run lint` + `npm run build`

## Transition Guard Test

```bash
# This should fail (staff cannot approve)
curl -s -X POST $API/items/$ID/transition \
  -H "Content-Type: application/json" \
  -H "x-user-id: staff1" -H "x-user-name: Staff" -H "x-user-role: staff" \
  -d '{"to":"approved"}'
# Expected: 422 error with valid_transitions
```

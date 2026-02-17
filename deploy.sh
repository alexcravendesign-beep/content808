#!/usr/bin/env bash
set -euo pipefail

echo "=== Content Hub v2 Deploy ==="
echo "Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

cd "$(dirname "$0")"

echo "[1/5] Fetching latest code..."
git fetch origin main
git reset --hard origin/main

echo "[2/5] Building containers..."
docker compose build --no-cache

echo "[3/5] Starting services..."
docker compose up -d

echo "[4/5] Waiting for services to be healthy..."
sleep 10

echo "[5/5] Running health checks..."
MAX_RETRIES=12
RETRY_COUNT=0
until curl -sf http://localhost:4000/health > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "FAIL: Backend health check failed after ${MAX_RETRIES} retries"
    docker compose logs backend --tail=50
    exit 1
  fi
  echo "  Waiting for backend... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 5
done

echo "Backend health: OK"

READY=$(curl -sf http://localhost:4000/ready | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "fail")
if [ "$READY" = "ready" ]; then
  echo "Backend ready: OK (DB connected)"
else
  echo "WARN: Backend /ready check returned: $READY"
fi

echo ""
echo "=== Deploy complete ==="
echo "Backend:  http://localhost:4000"
echo "Frontend: http://localhost:3000"

#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Kideliowear — Production deploy script
#
# Run on VPS from the repo root:
#   bash deploy/deploy.sh
#
# Prerequisites (one-time setup):
#   1. Docker installed  : curl -fsSL https://get.docker.com | sh
#   2. Node 20 installed : nvm install 20 && nvm use 20
#   3. .env.production   : cp deploy/.env.production.example deploy/.env.production
#                          (then fill in RAILS_MASTER_KEY, SECRET_KEY_BASE, etc.)
#   4. SSL cert obtained : certbot --nginx -d kideliowear.com -d www.kideliowear.com
#   5. Nginx configured  : see deploy/nginx-kideliowear.conf and deploy/DEPLOY.md
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$REPO_DIR/deploy"
COMPOSE="docker compose -f $DEPLOY_DIR/docker-compose.prod.yml"

echo "==> Deploying kideliowear from $REPO_DIR"

# ── 1. Pull latest code ───────────────────────────────────────────────────────
echo "==> Pulling latest code..."
cd "$REPO_DIR"
git pull

# ── 2. Check env file exists ─────────────────────────────────────────────────
if [ ! -f "$DEPLOY_DIR/.env.production" ]; then
  echo ""
  echo "ERROR: deploy/.env.production not found."
  echo "       Copy the example and fill in your values:"
  echo "       cp deploy/.env.production.example deploy/.env.production"
  exit 1
fi

# ── 3. Install frontend deps ─────────────────────────────────────────────────
echo "==> Installing frontend dependencies..."
npm ci --prefix frontend

# ── 4. Build React (export VITE_* vars from .env.production) ─────────────────
echo "==> Building frontend..."
set -a
# shellcheck disable=SC1091
source <(grep -E '^VITE_' "$DEPLOY_DIR/.env.production" 2>/dev/null | sed 's/\r$//' || true)
set +a
npm run build

# ── 5. Ensure storage directory exists ───────────────────────────────────────
echo "==> Ensuring storage directory..."
mkdir -p "$REPO_DIR/api/storage"

# ── 6. Build Docker images and restart containers ─────────────────────────────
echo "==> Building Docker images and restarting containers..."
$COMPOSE up -d --build

# ── 7. Wait for services to be healthy ────────────────────────────────────────
echo "==> Waiting for services to become healthy..."
for i in $(seq 1 30); do
  WEB_OK=$($COMPOSE ps --format json web 2>/dev/null | grep -c '"Health":"healthy"' || true)
  GO_OK=$($COMPOSE ps --format json go-service 2>/dev/null | grep -c '"Health":"healthy"' || true)
  if [ "$WEB_OK" -ge 1 ] && [ "$GO_OK" -ge 1 ]; then
    echo "    Rails + Go are healthy."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "WARNING: Health checks did not pass within 30 attempts. Check: $COMPOSE ps"
  fi
  sleep 2
done

# ── 8. Run database migrations ────────────────────────────────────────────────
echo "==> Running database migrations..."
$COMPOSE exec web bin/rails db:migrate

# ── 9. Clean up old Docker images ─────────────────────────────────────────────
echo "==> Cleaning up dangling Docker images..."
docker image prune -f

echo ""
echo "Deploy complete."
echo "  Site : https://kideliowear.com"
echo "  Go   : proxied at /go (chat, cart, favorites)"
echo "  Check: $COMPOSE ps"

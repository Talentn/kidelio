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
#   5. Nginx configured  : see nginx-kideliowear.conf
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$REPO_DIR/deploy"

echo "==> Deploying kideliowear from $REPO_DIR"

# ── 1. Pull latest code ───────────────────────────────────────────────────────
echo "==> Pulling latest code..."
cd "$REPO_DIR"
git pull

# ── 2. Install frontend deps (only if package-lock changed) ──────────────────
echo "==> Installing frontend dependencies..."
npm ci --prefix frontend

# ── 3. Build React and copy into api/public ───────────────────────────────────
echo "==> Building frontend..."
npm run build

# ── 4. Ensure storage directory exists and is writable ───────────────────────
echo "==> Ensuring storage directory..."
mkdir -p "$REPO_DIR/api/storage"

# ── 5. Check env file exists ─────────────────────────────────────────────────
if [ ! -f "$DEPLOY_DIR/.env.production" ]; then
  echo ""
  echo "ERROR: deploy/.env.production not found."
  echo "       Copy the example and fill in your values:"
  echo "       cp deploy/.env.production.example deploy/.env.production"
  exit 1
fi

# ── 6. Build Docker image and restart container ───────────────────────────────
echo "==> Building Docker image and restarting container..."
docker compose -f "$DEPLOY_DIR/docker-compose.prod.yml" up -d --build

# ── 7. Run database migrations inside the running container ───────────────────
echo "==> Running database migrations..."
docker compose -f "$DEPLOY_DIR/docker-compose.prod.yml" exec web bin/rails db:migrate

# ── 8. Clean up old Docker images ─────────────────────────────────────────────
echo "==> Cleaning up dangling Docker images..."
docker image prune -f

echo ""
echo "Deploy complete. Site is live at https://kideliowear.com"

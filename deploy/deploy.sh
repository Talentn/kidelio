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
#   3. .env.production   : ONCE ONLY: cp deploy/.env.production.example deploy/.env.production
#                          then fill in RAILS_MASTER_KEY (from api/config/master.key).
#                          Never re-copy the example — it wipes your secrets.
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

# ── 2. Check env file exists and required secrets are set ────────────────────
if [ ! -f "$DEPLOY_DIR/.env.production" ]; then
  echo ""
  echo "ERROR: deploy/.env.production not found."
  echo "       Copy the example and fill in your values:"
  echo "       cp deploy/.env.production.example deploy/.env.production"
  exit 1
fi

has_master_key=false
has_secret_base=false
grep -qE '^RAILS_MASTER_KEY=.+$' "$DEPLOY_DIR/.env.production" && has_master_key=true
grep -qE '^SECRET_KEY_BASE=.+$' "$DEPLOY_DIR/.env.production" && has_secret_base=true
if ! $has_master_key && ! $has_secret_base; then
  echo "ERROR: deploy/.env.production needs at least one of:"
  echo "  RAILS_MASTER_KEY → contents of api/config/master.key"
  echo "  SECRET_KEY_BASE  → openssl rand -hex 64"
  exit 1
fi
# Empty SECRET_KEY_BASE= overrides credentials and breaks Rails — strip it.
if grep -qE '^SECRET_KEY_BASE=$' "$DEPLOY_DIR/.env.production"; then
  echo "==> Removing empty SECRET_KEY_BASE= (use credentials via RAILS_MASTER_KEY instead)"
  sed -i '/^SECRET_KEY_BASE=$/d' "$DEPLOY_DIR/.env.production"
fi
# Rails proxies admin chat to Go with trusted staff headers — needs a shared secret.
if ! grep -qE '^GO_INTERNAL_SECRET=.+$' "$DEPLOY_DIR/.env.production"; then
  echo "==> Generating GO_INTERNAL_SECRET for Rails→Go internal auth"
  echo "GO_INTERNAL_SECRET=$(openssl rand -hex 32)" >> "$DEPLOY_DIR/.env.production"
fi
# Puma thread pool (must match database.yml max_connections)
if grep -qE '^RAILS_MAX_THREADS=' "$DEPLOY_DIR/.env.production"; then
  :
else
  echo "RAILS_MAX_THREADS=10" >> "$DEPLOY_DIR/.env.production"
fi
# WebSocket (chat, live cart, favorites) — baked into frontend at build time
if grep -qE '^VITE_ENABLE_CHAT_WS=' "$DEPLOY_DIR/.env.production"; then
  sed -i 's/^VITE_ENABLE_CHAT_WS=.*/VITE_ENABLE_CHAT_WS=true/' "$DEPLOY_DIR/.env.production"
else
  echo "VITE_ENABLE_CHAT_WS=true" >> "$DEPLOY_DIR/.env.production"
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

# ── 5. Ensure storage directory exists and is writable by container (uid 1000) ─
echo "==> Ensuring storage directory..."
mkdir -p "$REPO_DIR/api/storage/active_storage" "$REPO_DIR/api/storage/variants"
STORAGE_UID="$(stat -c '%u' "$REPO_DIR/api/storage" 2>/dev/null || echo 0)"
if [ "$STORAGE_UID" != "1000" ]; then
  echo "==> Fixing storage ownership (container runs as uid 1000)..."
  if sudo chown -R 1000:1000 "$REPO_DIR/api/storage"; then
    echo "    Done."
  else
    echo "ERROR: api/storage must be owned by uid 1000. Run:"
    echo "  sudo chown -R 1000:1000 $REPO_DIR/api/storage"
    exit 1
  fi
fi

# ── 6. Build Docker images and restart containers ─────────────────────────────
echo "==> Building Docker images and restarting containers..."
$COMPOSE up -d --build

# ── 7. Wait for services to be healthy ────────────────────────────────────────
echo "==> Waiting for services to become healthy (up to 3 min)..."
for i in $(seq 1 36); do
  WEB_OK=$($COMPOSE ps --format json web 2>/dev/null | grep -c '"Health":"healthy"' || true)
  GO_OK=$($COMPOSE ps --format json go-service 2>/dev/null | grep -c '"Health":"healthy"' || true)
  if [ "$WEB_OK" -ge 1 ] && [ "$GO_OK" -ge 1 ]; then
    echo "    Rails + Go are healthy."
    break
  fi
  if [ "$i" -eq 36 ]; then
    echo ""
    echo "ERROR: Services did not become healthy."
    $COMPOSE ps
    echo ""
    echo "── Rails logs (last 80 lines) ──"
    $COMPOSE logs --tail=80 web || true
    echo ""
    echo "── Go logs (last 40 lines) ──"
    $COMPOSE logs --tail=40 go-service || true
    exit 1
  fi
  sleep 5
done

# ── 8. Run database migrations ────────────────────────────────────────────────
echo "==> Running database migrations..."
$COMPOSE exec -T web bin/rails db:prepare

# ── 9. Clean up old Docker images ─────────────────────────────────────────────
echo "==> Cleaning up dangling Docker images..."
docker image prune -f

# ── 10. Nginx WebSocket routes (daizo-nginx or host nginx) ───────────────────
echo "==> Configuring nginx for WebSockets..."
bash "$DEPLOY_DIR/setup-ws.sh" || echo "WARN: WebSocket nginx setup failed — run: bash deploy/setup-ws.sh"

echo ""
echo "Deploy complete."
echo "  Site : https://kideliowear.com"
echo "  Go   : /api/v1/chat/* + WebSocket (chat, cart, favorites)"
echo "  Check: $COMPOSE ps"

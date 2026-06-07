#!/bin/bash
# Enable WebSocket routing for Kidelio (chat, live cart, favorites).
# Run on the VPS from repo root: bash deploy/setup-ws.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$REPO_DIR/deploy"
ENV_FILE="$DEPLOY_DIR/.env.production"
DAIZO_CONTAINER="${DAIZO_NGINX_CONTAINER:-daizo-nginx}"

echo "==> Kidelio WebSocket setup"

# ── 1. Enable frontend build flag ─────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "WARN: $ENV_FILE not found — create it before deploy."
else
  if grep -qE '^VITE_ENABLE_CHAT_WS=' "$ENV_FILE"; then
    sed -i 's/^VITE_ENABLE_CHAT_WS=.*/VITE_ENABLE_CHAT_WS=true/' "$ENV_FILE"
  else
    echo "VITE_ENABLE_CHAT_WS=true" >> "$ENV_FILE"
  fi
  echo "    VITE_ENABLE_CHAT_WS=true in deploy/.env.production"
fi

# ── 2. daizo-nginx (Docker reverse proxy in front of the VPS) ─────────────────
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$DAIZO_CONTAINER"; then
  echo "==> Configuring $DAIZO_CONTAINER..."
  docker cp "$DEPLOY_DIR/daizo-nginx-ws.conf" "$DAIZO_CONTAINER:/etc/nginx/kidelio-ws-locations.conf"

  CONF_FILE=""
  CONF_FILE="$(docker exec "$DAIZO_CONTAINER" sh -c "grep -rl 'kideliowear.com' /etc/nginx 2>/dev/null | head -1" || true)"

  if [ -n "$CONF_FILE" ] && docker exec "$DAIZO_CONTAINER" grep -q "kidelio-ws-locations" "$CONF_FILE" 2>/dev/null; then
    echo "    Include already present in $CONF_FILE"
  elif [ -n "$CONF_FILE" ]; then
    docker exec "$DAIZO_CONTAINER" sh -c "sed -i '/server_name.*kideliowear/i\\    include /etc/nginx/kidelio-ws-locations.conf;' \"$CONF_FILE\"" || true
    if docker exec "$DAIZO_CONTAINER" grep -q "kidelio-ws-locations" "$CONF_FILE" 2>/dev/null; then
      echo "    Added include to $CONF_FILE"
    else
      echo ""
      echo "MANUAL STEP — add this line inside the kideliowear.com server {} in $CONF_FILE:"
      echo "    include /etc/nginx/kidelio-ws-locations.conf;"
    fi
  else
    echo ""
    echo "MANUAL STEP — add inside kideliowear.com server {} in daizo-nginx:"
    echo "    include /etc/nginx/kidelio-ws-locations.conf;"
  fi

  if docker exec "$DAIZO_CONTAINER" nginx -t 2>/dev/null; then
    docker exec "$DAIZO_CONTAINER" nginx -s reload
    echo "    daizo-nginx reloaded."
  else
    echo "WARN: nginx -t failed in $DAIZO_CONTAINER — fix config then reload."
    docker exec "$DAIZO_CONTAINER" nginx -t || true
  fi
else
  echo "==> $DAIZO_CONTAINER not running — trying host nginx..."

  # ── 3. Host nginx (sites-available) ─────────────────────────────────────────
  HOST_CONF="/etc/nginx/sites-available/kideliowear"
  if [ -f "$HOST_CONF" ]; then
    if ! grep -q "chat/ws/" "$HOST_CONF" 2>/dev/null; then
      echo "    Updating $HOST_CONF from repo template..."
      sudo cp "$DEPLOY_DIR/nginx-kideliowear.conf" "$HOST_CONF"
    fi
    if sudo nginx -t 2>/dev/null; then
      sudo systemctl reload nginx
      echo "    Host nginx reloaded."
    else
      echo "WARN: sudo nginx -t failed — check $HOST_CONF"
    fi
  else
    echo "    No host nginx config at $HOST_CONF"
    echo "    If you use daizo-nginx, start it and re-run: bash deploy/setup-ws.sh"
  fi
fi

echo ""
echo "==> WebSocket setup done."
echo "    Redeploy so the frontend picks up VITE_ENABLE_CHAT_WS:"
echo "      bash deploy/deploy.sh"

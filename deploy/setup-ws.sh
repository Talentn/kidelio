#!/bin/bash
# Enable WebSocket routing for Kidelio (chat, live cart, favorites).
# Run on the VPS from repo root: bash deploy/setup-ws.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$REPO_DIR/deploy"
ENV_FILE="$DEPLOY_DIR/.env.production"
DAIZO_CONTAINER="${DAIZO_NGINX_CONTAINER:-}"

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

WS_CONFIGURED=false

find_nginx_container() {
  if [ -n "$DAIZO_CONTAINER" ]; then
    echo "$DAIZO_CONTAINER"
    return
  fi
  local name
  for name in daizo-nginx nginx daizo_nginx reverse-proxy; do
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$name"; then
      echo "$name"
      return
    fi
  done
  docker ps --format '{{.Names}}' 2>/dev/null | grep -i nginx | head -1 || true
}

configure_docker_nginx() {
  local container="$1"
  echo "==> Configuring Docker nginx: $container"
  docker cp "$DEPLOY_DIR/daizo-nginx-ws.conf" "$container:/etc/nginx/kidelio-ws-locations.conf"

  local conf_file=""
  conf_file="$(docker exec "$container" sh -c "grep -rl 'kideliowear.com' /etc/nginx 2>/dev/null | head -1" || true)"

  if [ -n "$conf_file" ] && docker exec "$container" grep -q "kidelio-ws-locations" "$conf_file" 2>/dev/null; then
    echo "    Include already present in $conf_file"
  elif [ -n "$conf_file" ]; then
    docker exec "$container" sh -c "grep -q 'kidelio-ws-locations' '$conf_file' || sed -i '/server_name.*kideliowear/i\\    include /etc/nginx/kidelio-ws-locations.conf;' '$conf_file'" || true
    if docker exec "$container" grep -q "kidelio-ws-locations" "$conf_file" 2>/dev/null; then
      echo "    Added include to $conf_file"
    else
      echo ""
      echo "MANUAL — inside $container, edit $conf_file and add BEFORE other /api/ blocks:"
      echo "    include /etc/nginx/kidelio-ws-locations.conf;"
    fi
  else
    echo ""
    echo "MANUAL — inside $container, add to kideliowear.com server {}:"
    echo "    include /etc/nginx/kidelio-ws-locations.conf;"
    echo "    (file copied to /etc/nginx/kidelio-ws-locations.conf)"
  fi

  if docker exec "$container" nginx -t; then
    docker exec "$container" nginx -s reload
    echo "    $container reloaded OK."
    WS_CONFIGURED=true
  else
    echo "ERROR: nginx -t failed in $container"
    docker exec "$container" nginx -t || true
  fi
}

configure_host_nginx() {
  local host_conf="/etc/nginx/sites-available/kideliowear"
  if [ ! -f "$host_conf" ]; then
    return 1
  fi

  echo "==> Configuring host nginx ($host_conf)..."
  if ! grep -q "chat/ws/" "$host_conf" 2>/dev/null; then
    echo "    Updating from repo template..."
    sudo cp "$DEPLOY_DIR/nginx-kideliowear.conf" "$host_conf"
  fi

  if ! sudo nginx -t; then
    echo "ERROR: host nginx -t failed"
    return 1
  fi

  if systemctl is-active --quiet nginx 2>/dev/null; then
    sudo systemctl reload nginx
    echo "    Host nginx reloaded OK."
    WS_CONFIGURED=true
    return 0
  fi

  echo "    Host nginx is installed but not running."
  echo "    Start it with: sudo systemctl start nginx"
  if sudo systemctl start nginx 2>/dev/null; then
    sudo systemctl reload nginx
    echo "    Started and reloaded host nginx."
    WS_CONFIGURED=true
    return 0
  fi
  return 1
}

# ── 2. Docker nginx (daizo or auto-detected) ─────────────────────────────────
NGINX_CTR="$(find_nginx_container)"
if [ -n "$NGINX_CTR" ]; then
  configure_docker_nginx "$NGINX_CTR"
else
  echo "==> No running Docker nginx container found."
  echo "    Running containers:"
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true
  echo ""
  echo "    Stopped nginx containers:"
  docker ps -a --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | grep -i nginx || echo "    (none)"
fi

# ── 3. Host nginx fallback ────────────────────────────────────────────────────
if [ "$WS_CONFIGURED" = false ]; then
  configure_host_nginx || true
fi

# ── 4. Summary ────────────────────────────────────────────────────────────────
echo ""
if [ "$WS_CONFIGURED" = true ]; then
  echo "==> WebSocket nginx setup OK."
else
  echo "==> WebSocket nginx was NOT applied. Diagnose:"
  echo ""
  echo "  # Find your reverse proxy"
  echo "  docker ps"
  echo "  systemctl status nginx"
  echo ""
  echo "  # If daizo-nginx exists but is stopped:"
  echo "  docker start daizo-nginx"
  echo "  DAIZO_NGINX_CONTAINER=daizo-nginx bash deploy/setup-ws.sh"
  echo ""
  echo "  # If nginx runs under another name (example):"
  echo "  DAIZO_NGINX_CONTAINER=your-nginx-container bash deploy/setup-ws.sh"
  echo ""
  echo "  # Manual copy into any nginx container:"
  echo "  docker cp deploy/daizo-nginx-ws.conf CONTAINER:/etc/nginx/kidelio-ws-locations.conf"
  echo "  # Then add inside kideliowear.com server {}:"
  echo "  include /etc/nginx/kidelio-ws-locations.conf;"
fi

echo ""
echo "    Rebuild frontend (required for WS in the app):"
echo "      bash deploy/deploy.sh"

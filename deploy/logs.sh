#!/bin/bash
# View production logs on the VPS.
#
#   bash deploy/logs.sh              # Rails + Go (last 100 lines each)
#   bash deploy/logs.sh rails        # Rails only
#   bash deploy/logs.sh go           # Go only
#   bash deploy/logs.sh follow       # Follow Rails logs (Ctrl+C to stop)
#   bash deploy/logs.sh follow go    # Follow Go logs
#   bash deploy/logs.sh nginx        # Nginx error + access (last 50 each)
#   bash deploy/logs.sh status       # Container health + quick API check
#   bash deploy/logs.sh rails 200    # Custom line count
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f $REPO_DIR/deploy/docker-compose.prod.yml"
LINES="${2:-100}"

cmd="${1:-all}"

compose_logs() {
  local service="$1"
  local tail="${2:-$LINES}"
  $COMPOSE logs --tail="$tail" "$service" 2>/dev/null || $COMPOSE logs --tail="$tail" "$service"
}

case "$cmd" in
  rails|web)
    echo "═══ Rails (web) — last $LINES lines ═══"
    compose_logs web "$LINES"
    ;;
  go|go-service)
    echo "═══ Go service — last $LINES lines ═══"
    compose_logs go-service "$LINES"
    ;;
  follow|f)
    target="${2:-web}"
    if [ "$target" = "go" ] || [ "$target" = "go-service" ]; then
      target="go-service"
    else
      target="web"
    fi
    echo "═══ Following $target (Ctrl+C to stop) ═══"
    $COMPOSE logs -f --tail=50 "$target"
    ;;
  nginx)
    echo "═══ Nginx error log — last 50 lines ═══"
    sudo tail -50 /var/log/nginx/error.log 2>/dev/null || echo "(nginx error.log not found or no sudo)"
    echo ""
    echo "═══ Nginx access log — last 50 lines ═══"
    sudo tail -50 /var/log/nginx/access.log 2>/dev/null || echo "(nginx access.log not found or no sudo)"
    ;;
  status|ps|health)
    echo "═══ Docker containers ═══"
    $COMPOSE ps
    echo ""
    echo "═══ Health checks ═══"
    curl -sf http://127.0.0.1:7675/up >/dev/null && echo "Rails /up     : OK" || echo "Rails /up     : FAIL"
    curl -sf http://127.0.0.1:7675/health >/dev/null && echo "Rails /health : OK" || echo "Rails /health : FAIL"
    curl -sf http://127.0.0.1:3010/health >/dev/null && echo "Go /health    : OK" || echo "Go /health    : FAIL"
    curl -sf http://127.0.0.1:7675/api/v1/store >/dev/null && echo "API /store    : OK" || echo "API /store    : FAIL"
    ;;
  all|"")
    echo "═══ Rails (web) — last $LINES lines ═══"
    compose_logs web "$LINES"
    echo ""
    echo "═══ Go service — last $LINES lines ═══"
    compose_logs go-service "$LINES"
    ;;
  help|-h|--help)
    sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    echo "Unknown command: $cmd"
    echo "Run: bash deploy/logs.sh help"
    exit 1
    ;;
esac

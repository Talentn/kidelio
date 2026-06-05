#!/bin/bash
# Backup Go service SQLite database from the Docker volume.
# Usage: bash deploy/backup-go-db.sh [output-dir]
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${1:-$REPO_DIR/deploy/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$OUT_DIR/go-service-$STAMP.db"

mkdir -p "$OUT_DIR"

docker compose -f "$REPO_DIR/deploy/docker-compose.prod.yml" exec -T go-service \
  sh -c 'cat /app/data/go-service.db' > "$OUT_FILE"

echo "Backup saved: $OUT_FILE"

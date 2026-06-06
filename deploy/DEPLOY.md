# Production deployment — Kideliowear

## Architecture

```
Internet → daizo-nginx (Docker, :443) → 172.17.0.1:7675  Rails (SPA + /api)
                                        → 172.17.0.1:3010  Go (/go → chat, cart, favorites)
```

**Important:** If nginx runs inside Docker (`daizo-nginx`), it reaches the host via the
Docker bridge IP `172.17.0.1`. Ports in `docker-compose.prod.yml` must **not** be bound
to `127.0.0.1` only — use `7675:3000` and `3010:3010` so they listen on all interfaces.

| Service | Container | Host port | Public path |
|---------|-----------|-----------|-------------|
| Rails | `web` | `7675` → container `3000` | `/`, `/api/` |
| Go | `go-service` | `3010` | `/go/` |

## One-time VPS setup

1. Install Docker, Node 20, nginx, certbot.
2. Clone the repo to e.g. `/var/www/kids-shop`.
3. Copy env file:
   ```bash
   cp deploy/.env.production.example deploy/.env.production
   ```
   Fill in `RAILS_MASTER_KEY`, `SECRET_KEY_BASE`, Meta/Google credentials, `VITE_META_PIXEL_ID`.
4. Obtain SSL certificate:
   ```bash
   sudo certbot --nginx -d kideliowear.com -d www.kideliowear.com
   ```
5. Install nginx config:
   ```bash
   sudo cp deploy/nginx-kideliowear.conf /etc/nginx/sites-available/kideliowear
   sudo ln -sf /etc/nginx/sites-available/kideliowear /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

## Deploy

From the repo root on the VPS:

```bash
bash deploy/deploy.sh
```

This will: pull code → `npm ci` → build frontend into `api/public` → `docker compose up --build` → migrate.

## Go service

- **Chat**: customer widget + admin `/admin/chat`
- **Cart / favorites tracking**: admin `/admin/panier-live`
- **Auth**: admin endpoints validate Rails session cookies via internal `http://web:80/api/v1/auth/me`
- **Data**: SQLite in Docker volume `go_service_data`

### Backup Go database

```bash
bash deploy/backup-go-db.sh
```

Schedule with cron if needed (e.g. daily).

### Health checks

```bash
curl http://127.0.0.1:7675/health   # Rails
curl http://127.0.0.1:3010/health   # Go
```

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `RAILS_MASTER_KEY`, `SECRET_KEY_BASE` | `deploy/.env.production` | Rails secrets |
| `SITE_URL`, `API_URL`, `FRONTEND_URL` | `deploy/.env.production` | Canonical URLs |
| `VITE_META_PIXEL_ID` | `deploy/.env.production` | Baked into frontend at build |
| `SOLID_QUEUE_IN_PUMA` | `deploy/.env.production` | Background jobs |
| `ALLOWED_ORIGINS` | `docker-compose.prod.yml` | Go CORS / WebSocket origins |
| `RAILS_URL` | `docker-compose.prod.yml` | Go → Rails auth (`http://web:80`) |

## Updating nginx after config changes

```bash
sudo cp deploy/nginx-kideliowear.conf /etc/nginx/sites-available/kideliowear
sudo nginx -t && sudo systemctl reload nginx
```

## Troubleshooting

### 504 Gateway Timeout (daizo-nginx)

If nginx runs in the **daizo-nginx** container, it proxies to `http://172.17.0.1:7675`.
That fails when compose binds ports to localhost only:

```yaml
# BAD — daizo-nginx cannot reach this
ports:
  - "127.0.0.1:7675:3000"

# GOOD — reachable via Docker bridge
ports:
  - "7675:3000"
  - "3010:3010"
```

Verify from inside daizo-nginx:

```bash
docker exec daizo-nginx curl -s http://172.17.0.1:7675/up
docker exec daizo-nginx curl -s http://172.17.0.1:3010/health
```

Ensure daizo-nginx also proxies `/go/` to `http://172.17.0.1:3010`.

### `deploy-web-1 is unhealthy`

Most common cause: **storage permissions**. The Rails container runs as uid `1000`.

```bash
sudo chown -R 1000:1000 api/storage
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

Check Rails logs:

```bash
docker compose -f deploy/docker-compose.prod.yml logs --tail=100 web
```

Other causes:

| Cause | Fix |
|-------|-----|
| Missing `RAILS_MASTER_KEY` | Copy `api/config/master.key` value into `deploy/.env.production` |
| `secret_key_base must be a String` | Remove empty `SECRET_KEY_BASE=` from `.env.production`, or set a real value (`openssl rand -hex 64`) |
| `permission denied` on docker | `sudo usermod -aG docker $USER` then log out/in, or prefix commands with `sudo` |
| `db:prepare failed` | Fix storage permissions (above), then redeploy |
| First boot slow | Health check allows 2 min (`start_period: 120s`) — wait and retry |

Verify manually:

```bash
docker compose -f deploy/docker-compose.prod.yml exec web curl -f http://127.0.0.1:80/up
```

### Other issues

| Symptom | Check |
|---------|-------|
| Chat button does nothing | `POST /go/chat/rooms` must not return Rails 404 — Rails proxies `/go` to Go when nginx does not; redeploy after pulling |
| Admin chat 401 | Logged in as admin/employee? Session cookie must reach `/go` |
| WebSocket fails | nginx `/go/` block has Upgrade headers; Go container healthy; or rely on Rails `/go` proxy |
| Go unhealthy | `docker compose -f deploy/docker-compose.prod.yml logs go-service` |
| Chat queue stale | Restart Go: `docker compose -f deploy/docker-compose.prod.yml restart go-service` |

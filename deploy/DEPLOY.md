# Production deployment — Kideliowear

## Architecture

```
Internet → nginx (443) → Rails :7675  (SPA + /api)
                       → Go     :3010  (/go → chat, cart, favorites)
```

Both containers bind to **localhost only** — nginx is the only public entry point.

| Service | Container | Host port | Public path |
|---------|-----------|-----------|-------------|
| Rails (Thruster) | `web` | `127.0.0.1:7675` | `/`, `/api/` |
| Go microservice | `go-service` | `127.0.0.1:3010` | `/go/` |

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

| Symptom | Check |
|---------|-------|
| Admin chat 401 | Logged in as admin/employee? Session cookie must reach `/go` |
| WebSocket fails | nginx `/go/` block has Upgrade headers; Go container healthy |
| Go unhealthy | `docker compose -f deploy/docker-compose.prod.yml logs go-service` |
| Chat queue stale | Restart Go: `docker compose -f deploy/docker-compose.prod.yml restart go-service` |

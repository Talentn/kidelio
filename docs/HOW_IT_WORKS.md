# Kidelio (kids-shop) — How the website works

This document describes the architecture of **kideliowear.com**: the React storefront, the Rails API, the Go real-time service, and how data flows between them.

---

## Overview

Kidelio is an e-commerce site for children's clothing and toys in Tunisia. It is built as three cooperating services behind one domain:

| Layer | Technology | Role |
|-------|------------|------|
| **Storefront + Admin UI** | React (Vite/CRA) in `frontend/` | Pages, routing, cart UI, admin back-office |
| **Business API** | Ruby on Rails 8 in `api/` | Products, cart, orders, auth, payments, admin CRUD |
| **Real-time service** | Go in `go-service/` | Live chat, cart/favorite activity tracking |

In **production**, nginx routes traffic:

- Static React build and most `/api/v1/*` → **Rails** (Docker port 7675)
- Explicit Rails proxy routes forward chat/cart/favorite REST to **Go** (Docker port 3010)
- WebSockets are **disabled by default** in production; HTTP polling and POST fallbacks are used instead

---

## Repository layout

```
kids-shop/
├── frontend/          # React app (shop + admin)
├── api/               # Rails JSON API + jobs
├── go-service/        # Chat, live cart/favorite events
├── deploy/            # Docker Compose, nginx, deploy scripts
├── docs/              # Documentation (this file)
└── scripts/dev.js     # Local dev: Rails :3001 + Go :3010 + React :3000
```

Legacy folders (`web/`, `admin/`) are unused. The single React app in `frontend/` serves both shoppers and staff.

---

## Local development

```bash
npm run setup   # once
npm run dev     # React :3000, Rails :3001, Go :3010
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | React UI |
| http://localhost:3001/api/v1/... | Rails API |
| http://localhost:3010/health | Go service |

Staff login: `admin@kids-shop.local` / `password123` (seed data).

The React dev server proxies `/api` to Rails. Go is reached via Rails `GoProxyController` at `/api/v1/chat/*`, `/api/v1/cart/*`, etc.

---

## Production deployment

See `deploy/DEPLOY.md` for the full VPS guide. Summary:

1. **Rails** (`deploy-web-1`) — port **7675** → business logic, sessions, SQLite/Postgres DB
2. **Go** (`deploy-go-service-1`) — port **3010** → chat DB (SQLite volume), event feeds
3. **nginx** (`daizo-nginx`) — TLS, routes `kideliowear.com` to Rails and static files

Deploy from the server:

```bash
cd /home/user/kideliowear
git pull
bash deploy/deploy.sh
```

Secrets live in `deploy/.env.production` (`RAILS_MASTER_KEY`, `GO_INTERNAL_SECRET`, Meta/Google keys, etc.).

---

## Authentication

### Shoppers and staff

- **Session cookie**: `_kids_shop_session` (HttpOnly, Secure in production, 30 days)
- Login: `POST /api/v1/auth/login` → Rails sets session
- Current user: `GET /api/v1/auth/me`
- Roles: `client`, `employee`, `admin` (staff = employee or admin)

### Guest checkout

Orders and cart work **without an account**. The cart is stored **server-side** keyed by the Rails session (same cookie), not in `localStorage`.

### Admin access

- Admin UI routes: `/admin/*` protected by `RequireStaff` (React)
- Admin API: `/api/admin/*` protected by `require_staff!` (Rails)
- Go admin endpoints: Rails verifies staff, then forwards trusted headers (`GO_INTERNAL_SECRET`) to Go

---

## Cart

| Concern | Where |
|---------|--------|
| Storage | Rails `CartManager` + session |
| API | `/api/v1/cart` (GET, POST items, PATCH, DELETE) |
| UI | `CartContext`, `CartDrawer`, `/panier` |
| Live tracking | Go service — add/remove events for admin dashboard |

Flow:

1. User clicks “Ajouter au panier” → `POST /api/v1/cart/items`
2. Rails updates session cart, returns items + totals
3. Frontend broadcasts `cart` event (cross-tab sync)
4. Optionally sends a tracking event to Go (`POST /api/v1/cart/events` in production)

Shipping: **7 TND** flat, free from **200 TND**. Payment: cash on delivery.

---

## Favorites (guest-friendly)

Favorites do **not** require login.

| Concern | Where |
|---------|--------|
| Storage | Browser cookie `kidelio_favs` (JSON array of product IDs, 1 year) |
| Fallback | `localStorage` mirror if cookies are blocked |
| UI | Heart on product cards, product page, header badge |
| Page | `/favoris` — loads products via `GET /api/v1/products?ids=1,2,3` |
| Live tracking | Go — favorite add/remove events for admin “Activité live” |

Limits: up to **50** products per device. Clearing cookies removes favorites on that device.

---

## Catalog & orders

### Products

- `GET /api/v1/products` — list with filters (`category`, `q`, `age`, `featured`, `on_promo`, `ids`)
- `GET /api/v1/products/:slug` — detail with colors, sizes, images (WebP variants)
- Images: Active Storage + on-the-fly variants (`thumb`, `medium`, `large`)

### Checkout

1. `/checkout` — shipping form, promo code
2. `POST /api/v1/orders` — creates order, clears cart
3. `/commande/:orderNumber` — confirmation
4. `/suivi/:orderNumber` — order tracking (guest-friendly)

### Admin

Staff manage products, stock, categories, homepage, orders, promo codes, users, contact messages, activity logs, chat, and live analytics from `/admin`.

---

## Chat support

### Customer

- Floating **ChatWidget** on all pages
- `POST /api/v1/chat/rooms` — start conversation
- Messages: WebSocket in dev; **HTTP** `GET/POST /api/v1/chat/rooms/:id/messages` in production

### Staff

- `/admin/chat` — queue + active conversations
- `/admin/chat-archives` — closed conversations (search + transcript)
- HTTP polling every 2–3s when WebSockets are off

Go stores rooms and messages in its SQLite database (`go_service_data` Docker volume). Back up with `deploy/backup-go-db.sh`.

---

## Live activity (admin)

`/admin/panier-live` shows real-time:

- **Panier** — cart add/remove/update events
- **Favoris** — favorite toggle events

In production, events are sent via HTTP (`POST /api/v1/cart/events`, `POST /api/v1/favorites/events`) and the admin page polls every 3 seconds.

---

## Frontend architecture

```
App
├── AuthProvider        # user session, localStorage cache for UX
├── CartProvider        # server cart + Go tracking
├── FavoritesProvider   # cookie-based favorites
├── StoreProvider       # shop config
└── Routes
    ├── Layout (shop)   # header, footer, mobile nav
    └── /admin          # RequireStaff + AdminLayout
```

Key libraries:

- **api/client** — REST client with GET cache + deduplication
- **goApi** — Go proxy paths under `/api/v1`, WS flag `VITE_ENABLE_CHAT_WS`
- **broadcast** — cross-tab sync (auth, cart, favorites)

---

## API surface (Rails `/api/v1`)

| Area | Examples |
|------|----------|
| Auth | `auth/me`, `auth/login`, `auth/register`, `auth/logout` |
| Catalog | `products`, `categories`, `config` |
| Cart | `cart`, `cart/items` |
| Orders | `orders`, order tracking |
| Contact | `contact_messages` |
| Go proxy | `chat/*`, `cart/events`, `cart/admin/events`, `favorites/*` |

Admin CRUD lives under `/api/admin/*` (separate namespace).

---

## Go service routes (internal)

Reached via Rails `GoServiceClient` at `GO_SERVICE_URL` (default `http://go-service:3010`):

| Path | Purpose |
|------|---------|
| `POST /chat/rooms` | New chat room |
| `GET/POST /chat/rooms/{id}/messages` | Chat messages |
| `GET /chat/admin/queue` | Waiting customers |
| `GET /chat/admin/archives` | Closed chats |
| `POST /cart/events` | Cart activity from browser |
| `POST /favorites/events` | Favorite activity from browser |

Staff auth: cookie forward + `X-Kidelio-Internal` trusted headers from Rails.

---

## Environment variables (production)

| Variable | Purpose |
|----------|---------|
| `RAILS_MASTER_KEY` | Decrypt Rails credentials |
| `GO_INTERNAL_SECRET` | Rails ↔ Go staff auth |
| `SITE_URL` | Canonical URL |
| `VITE_META_PIXEL_ID` | Meta Pixel (frontend build) |
| `VITE_ENABLE_CHAT_WS` | `true` to enable WebSockets (needs nginx WS config) |

See `deploy/.env.production.example` for the full list.

---

## Data stores

| Data | Database |
|------|----------|
| Users, products, orders, categories | Rails DB |
| Chat rooms & messages | Go SQLite (`go_service_data` volume) |
| Cart/favorite live events | Go SQLite |
| Uploaded images | `api/storage/` (Active Storage) |

---

## Security notes

- CSRF skipped for JSON API; session cookie is the auth boundary
- Staff actions require role check on Rails before Go proxy
- Rate limits on Go: chat room creation, message send, cart/favorite events
- Cookie consent banner for analytics (Meta Pixel)

---

## Useful commands

```bash
# Local dev
npm run dev

# Production build (copies React into api/public for single-server mode)
npm run build

# Deploy on VPS
bash deploy/deploy.sh

# Backup Go DB
bash deploy/backup-go-db.sh
```

For nginx and multi-site setup on the shared VPS, see `deploy/DEPLOY.md` and `deploy/nginx-kideliowear.conf`.

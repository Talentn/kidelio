# Kids Shop

**Rails backend** + **React frontend only**.

## Run

```powershell
cd "c:\Users\Ala Ghabi\kids-shop"
npm run setup
npm run dev
```

| What | URL |
|------|-----|
| **React UI** (shop + admin) | http://localhost:3000 |
| **Rails JSON API** | http://localhost:3001 |
| Admin login | http://localhost:3000/admin/connexion |

**Staff:** `admin@kids-shop.local` / `password123`

## Split of work

| Layer | Folder | Does |
|-------|--------|------|
| **Frontend** | `frontend/` | React (CRA) — pages, routing, display only |
| **Backend** | `api/` | Models, cart, orders, auth, admin API, jobs, security |

React talks to Rails via **JSON REST** + **session cookies** (proxied in dev).

Cart lives on the **server** (`CartManager` + `/api/v1/cart`), not in `localStorage`.

## Production

```powershell
npm run build
cd api
bundle exec rails server -p 3000
```

Build copies React into `api/public/` — one server serves UI + `/api`.

## Legacy folders

- `web/`, `admin/` — old split React apps, ignore
- `api/app/views/store`, `api/app/controllers/store` — unused HTML; API + React is the path

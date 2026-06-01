# Architecture

```
┌─────────────────────────────────────┐
│  React (frontend/)  :3000           │  UI only — shop + /admin
│  fetch + credentials (cookies)      │
└──────────────┬──────────────────────┘
               │ JSON /api/v1, /api/admin
               ▼
┌─────────────────────────────────────┐
│  Rails (api/)  :3001                │  90% of the work
│  • CartManager (session)            │
│  • OrderCreator, Product, Order     │
│  • Auth, ActivityLog, Solid Queue   │
│  • rack-attack, image compression   │
└─────────────────────────────────────┘
```

## Rules

1. **Business logic stays in Rails** — never trust React for prices or stock.
2. **React only renders** and calls the API.
3. **Cart** — `GET/POST/PATCH/DELETE /api/v1/cart/*` (server session).
4. **Checkout** — `POST /api/v1/orders` uses server cart + validates on Rails.
5. **Admin** — React at `/admin/*` → `/api/admin/*`.

## Communication

- Browser ↔ Rails: **JSON REST** (fast, standard)
- Auth: **HttpOnly session cookie**
- Async: **Solid Queue** (`ProcessOrderJob`) — not between browser and API

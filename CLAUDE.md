# VendorCompare — Project Context

## What This Is

VendorCompare is a vendor order optimization tool for restaurant purchasing. Given a list of ingredients with quantities, it automatically splits the order across vendors (US Foods, Food Direct, Riviera Produce) for optimal pricing.

**Live URL:** https://aitoolchest.space/vendorcompare/
**Local dev:** http://localhost:3000 (frontend), http://localhost:8000 (backend)

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python 3.11), SQLAlchemy ORM, SQLite |
| Frontend | React 18, Vite, Tailwind CSS, React Router, Axios |
| Containers | Docker, docker-compose v2 (dev + prod variants) |
| Deployment | Caddy reverse proxy on Hetzner VPS (aitoolchest.space) |

---

## Directory Structure

```
Phase_1_Scaffolding/           ← workdir (CC runs here)
├── CLAUDE.md                  ← this file
├── ARCHITECTURE.md            ← full technical reference
├── docker-compose.yml         ← dev (both frontend + backend)
├── docker-compose.prod.yml    ← prod (backend only)
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py            ← FastAPI app, route registration
│       ├── database.py        ← SQLAlchemy session + engine
│       ├── models.py          ← DB models (see below)
│       ├── schemas.py         ← Pydantic request/response schemas
│       ├── seed.py            ← Products/vendors/categories seed
│       ├── seed_prices.py     ← Price seed (313 records)
│       └── routers/
│           ├── vendors.py
│           ├── products.py
│           ├── categories.py
│           ├── prices.py
│           └── orders.py      ← core order assembly logic
│
└── frontend/
    ├── Dockerfile
    ├── vite.config.js         ← base: '/vendorcompare/' (prod)
    ├── .env.production        ← VITE_API_BASE=/vendorcompare/api
    └── src/
        ├── main.jsx           ← BrowserRouter basename={BASE_URL}
        ├── api.js             ← Axios, baseURL from VITE_API_BASE
        ├── pages/
        │   ├── Home.jsx       ← catalog, product selection
        │   └── OrderAssembly.jsx ← vendor splits, savings
        ├── components/
        │   ├── Header.jsx
        │   ├── CategorySection.jsx
        │   └── ProductRow.jsx
        └── context/
            └── OrderContext.jsx  ← global selected items state
```

---

## Database Models

```
Location   — restaurant locations (currently: White Plains)
Category   — Fridge, Proteins, Produce, Spices, Dry Goods, Dishwashing Machine
Vendor     — Food Direct, US Foods, Riviera Produce
Product    — 125 products with category + sort_order
Price      — 313 records (product × vendor × price, timestamped)
Order      — saved orders (Phase 3)
OrderItem  — line items per order (Phase 3)
OrderVendorSplit — per-vendor totals per order (Phase 3)
```

---

## API Routes (8 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/vendors` | All vendors |
| GET | `/api/categories` | Categories with product counts |
| GET | `/api/products` | Products (optional `?category_id=`) |
| GET | `/api/prices` | All prices (optional `?product_id=`) |
| GET | `/api/prices/product/{id}` | Prices for one product across all vendors |
| POST | `/api/orders/assemble` | Core logic: split order across cheapest vendors |
| *(Phase 3)* | `/api/orders/save` | Save assembled order to DB |

**Order assembly input:**
```json
{ "location_id": 1, "items": [{ "product_id": 1, "quantity": 2 }] }
```

**Order assembly output:** vendor assignments, per-vendor totals, total savings, items_carried flags, comparison data, unpriced items.

---

## Key Conventions

- **Python:** snake_case, routers in `app/routers/`, schemas in `app/schemas.py`
- **React:** PascalCase components, camelCase hooks, functional components only
- **State:** all global order state goes through OrderContext — do not use local state for selected items
- **API base URL:** Never hardcode `localhost:8000`. Use `import.meta.env.VITE_API_BASE || '/api'`
- **Routing:** React Router with `basename={import.meta.env.BASE_URL}` — critical for subpath deployment
- **Docker:** always `docker compose` (v2), never `docker-compose`

---

## Load-Bearing Behaviors — Preserve Across All Phases

These behaviors are non-obvious from code alone. They MUST survive every phase. When modifying these files, preserve existing behavior and add alongside it — never replace.

| Component | Behavior to Preserve |
|-----------|---------------------|
| `Header.jsx` | Clipboard icon → `/order-assembly` with selected item count badge (uses `useOrder()` from OrderContext) |
| `Header.jsx` | Clock icon → `/history` (added Phase 3) |
| `main.jsx` | `<BrowserRouter basename={import.meta.env.BASE_URL}>` — required for subpath deploy; removing this causes blank page on production |
| `OrderContext.jsx` | Single source of truth for selected items — all components read from here, never local state |
| `api.js` | `baseURL: import.meta.env.VITE_API_BASE || '/api'` — never hardcode localhost |

---

## What NOT to Touch

- `backend/app/seed.py` and `seed_prices.py` — idempotent, do not modify seeded data counts
- `backend/vendorcompare.db` — live database, do not delete or recreate
- `frontend/dist/` — generated build output, do not hand-edit
- `frontend/.env.production` — production-only env vars, do not change base paths
- `vite.config.js` `base:` setting — production subpath, do not remove

---

## What's Built (Phases 1 + 2)

**Phase 1 — Scaffolding (Callout 001):**
- FastAPI backend with all routes, SQLAlchemy models, Docker setup
- React frontend with Vite + Tailwind, category/product catalog
- 125 products seeded across 6 categories and 3 vendors

**Phase 2 — Order Assembly (Callout 002):**
- 313 price records seeded (75 products with 3-vendor coverage)
- `POST /api/orders/assemble` endpoint with cheapest-vendor logic
- OrderAssembly.jsx page with vendor splits, savings banner, items_carried tracking
- OrderContext for cross-page state persistence
- Delete-key quantity bug fixed

**Phase 3 — Pending (Callout 003 incoming):**
- Save assembled orders to database
- Order history / PDF export
- Details TBD in Callout 003

---

## Production Deployment Notes

The dev build runs Vite dev server. Production uses static files built with `vite build`.

**Production-specific changes (DO NOT revert):**
- `vite.config.js`: `base: '/vendorcompare/'`
- `frontend/.env.production`: `VITE_API_BASE=/vendorcompare/api`
- `frontend/src/main.jsx`: `<BrowserRouter basename={import.meta.env.BASE_URL}>`
- `frontend/src/api.js`: `baseURL: import.meta.env.VITE_API_BASE || '/api'`

These are required for Caddy subpath routing at `/vendorcompare`. Without them the app renders blank on the live server.

---

## Running Locally

```bash
# Start both services
docker compose up -d

# Seed if fresh
docker compose exec backend python -m app.seed
docker compose exec backend python -m app.seed_prices

# Build for production
docker compose run --rm frontend sh -c "npm install && npm run build"

# Deploy frontend to Hetzner (run from project root after build)
rsync -avz --delete \
  -e "ssh -i ~/.ssh/hetzner" \
  frontend/dist/ \
  root@178.156.175.45:/var/www/aitoolchest/vendorcompare/
```

**Always run both steps.** Build without deploy = local only. The `--delete` flag removes stale bundles from previous builds automatically.

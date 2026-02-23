# VendorCompare

Restaurant procurement price comparison tool. Compare vendor prices and assemble optimized orders.

## Tech Stack

- **Backend:** Python 3.11 / FastAPI / SQLAlchemy / SQLite
- **Frontend:** React 18 / Tailwind CSS / Vite
- **Deployment:** Docker

## Quick Start

### With Docker (recommended)

```bash
docker-compose up --build
```

Then seed the database:

```bash
docker-compose exec backend python -m app.seed
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Without Docker

**Backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/categories | List categories with product counts |
| GET | /api/products | List products grouped by category |
| GET | /api/products?category_id=X | Filter products by category |
| GET | /api/vendors | List vendors |
| GET | /api/health | Health check |

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application
│   │   ├── database.py      # SQLAlchemy setup
│   │   ├── models.py        # Database models
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── seed.py          # Database seed script
│   │   └── routers/
│   │       ├── categories.py
│   │       ├── products.py
│   │       └── vendors.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── api.js
│   │   ├── pages/
│   │   │   └── Home.jsx
│   │   └── components/
│   │       ├── Header.jsx
│   │       ├── CategorySection.jsx
│   │       └── ProductRow.jsx
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Seed Data

- 1 Location: White Plains
- 3 Vendors: Food Direct, US Foods, Riviera Produce
- 6 Categories: Fridge, Proteins, Produce, Spices, Dry Goods, Dishwashing Machine
- 150+ Products

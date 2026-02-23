# Claude Code Brief: VendorCompare Project Scaffolding + Prototype

**Project:** VendorCompare  
**From:** Tariss (Kitchen)  
**Date:** February 17, 2026

---

## Context

VendorCompare is a web app for restaurant procurement price comparison. The client (John, restaurant owner) currently spends 4-5 hours/week manually comparing vendor prices and assembling orders. This tool replaces that manual process.

**This brief:** Create the initial project scaffolding (backend + frontend) and build a working prototype of the Home/Product Catalog screen connected to a seeded database.

**Tech stack:**
- Backend: Python 3.11+ / FastAPI / SQLAlchemy / SQLite
- Frontend: React 18 / Tailwind CSS / Vite
- Deployment target: VPS (Docker)

---

## Part 1: Backend Scaffolding

Create `backend/` directory with:
- FastAPI app (`app/main.py`, `app/database.py`, `app/models.py`, `app/schemas.py`)
- API routers for categories, products, vendors
- Database seed script with: 1 location (White Plains), 3 vendors (Food Direct, US Foods, Riviera Produce), 6 categories (Fridge, Proteins, Produce, Spices, Dry Goods, Dishwashing Machine), ~150 products
- SQLite database
- requirements.txt: fastapi, uvicorn, sqlalchemy, pydantic, python-dotenv
- Dockerfile

**Key models:** Location, Category, Product, Vendor, Price, Order, OrderItem, OrderVendorSplit

**API endpoints:**
- GET /api/categories (with product counts)
- GET /api/products (grouped by category)
- GET /api/products?category_id=X
- GET /api/vendors

---

## Part 2: Frontend Scaffolding

Create `frontend/` directory with:
- React 18 + Vite setup
- Tailwind CSS configured
- Components: CategorySection, ProductRow, Header
- Pages: Home (product catalog)
- API client (Axios) with proxy to backend
- package.json with react, react-dom, react-router-dom, axios, tailwindcss, vite
- Dockerfile

**Vite proxy config:** `/api` → `http://localhost:8000`

---

## Part 3: Prototype Home Screen

Build Product Catalog screen:

**Mobile-first layout (375px target):**
- Fixed header (60px): menu icon, "Cantina Orders", user icon
- Scrollable body: Category accordion sections
- Fixed footer (70px): "Assemble Orders" button + item count

**Features:**
- Category accordion (tap to expand/collapse)
- Product rows: checkbox + name + quantity input (when checked)
- State management: useState for categories, products, expandedCategories, selectedItems
- API integration: fetch on mount, loading spinner, error handling
- Tailwind styling (mobile-first, responsive)

**NOT implemented:** Backend POST for "Assemble Orders" (that's Callout 002)

---

## Part 4: Docker Setup

Create root `docker-compose.yml`:
- Backend service (port 8000, uvicorn with reload)
- Frontend service (port 3000, npm run dev)
- Volume mounts for hot reload

Create Dockerfiles for both backend and frontend.

Create root README.md with setup instructions.

---

## Product Catalog Seed Data (150+ items across 6 categories)

**Fridge:** Plantains, 12 Inch Flour Tortillas, 5 Inch Flour Tortillas, Empanada Discos, Eggs X-Large Loose, Heavy Mayonnaise, Sour Cream, Queso Fresco, Oaxaca, Shred Cheese Quesadilla, Cotija, Strawberry Puree Island Oasis, Passion Fruit Puree Island Oasis, Fresh Lime Juice, Goat Cheese, Ginger Beer

**Proteins:** Chicken Thigh, Wings, Pork Belly, Pork Butt, Steak, Chorizo, Fish, 51-60 Shrimp, 16-20 Shrimp, Frozen Falafel

**Produce:** Plum Tomato, Spanish Onion, Red Pepper, Green Pepper, Tomatillos, Limes, Jalapeños, Red Cabbage, Romaine Lettuce, Mint, Cilantro, Parsley, Orange, Pineapple (Market), Avocado, Spinach, Arugula, Corn, Fresh Garlic

**Spices:** Onion Powder, Garlic Powder, Bay Leaves, Black Pepper, Kosher Salt, Spanish Paprika, Dark Chili Powder, Old Bay, Guajillo, Tamarind, Oregano Flakes, Oregano Leaves, Chili de Arbol, Hibiscus, Crushed Red Pepper, Thyme, Cumin, Cinnamon Sticks, Chile Pastilla, Piloncillo

**Dry Goods:** (58 items) Black Wrapped Plastic Straws, Flour, Maseca, Sugar, Canned Corn, Black Beans, White Vinegar, Red Wine Vinegar, Sherry Vinegar, Tomato Juice, Pineapple Juice, Ranch Dressing, Blue Cheese Dressing, Tortilla Chips for Table, Mango Puree, Parboiled Rice, Arugula, Honey, Sazon, Canola Oil, Yucatec Green Sauce, Yucatec Red Sauce, Aluminum Foil 7/11 Sheets, Large Aluminum Foil Roll, Cocktail Napkins, Dinner Napkins, 7 Inch Aluminum Plates, 7 Inch Flat Lids, 8 Inch Aluminum Plates, 8 Inch Flat Lids, Plastic Shopping Bags, Black Garbage Bags, #8 White Paper Bags, #12 White Paper Bags, #20 White Paper Bags, Toilet Tissue, Bleach, Printer Paper Floor 7313 SP, Printer Paper Kitchen 2300 SP, Meal Kit Combo Packs, 2 oz Black Soufflé Cups, 2 oz Soufflé Lids, Large Plastic Gloves, Small Plastic Gloves, 32 oz Soup Combo Packs, Wax Paper SW6, Wax Paper SW10, Large Plastic Film Wrap, Small Plastic Film Wrap, Buffalo Sauce, Whipped Cream, Pot & Pan Soap, Lavender Floor Cleaner, Pine Wood Floor Cleaner, Hand Soap, Maraschino Cherries, Soy Sauce

**Dishwashing Machine:** Red 'Cleaner', Blue 'Glass Dry', Yellow 'Sanitizer'

---

## Critical Requirements

1. **Preserve product names exactly** (including "Arugula" appearing twice)
2. **Category sort order matters** - render in exact order above
3. **Mobile-first** - test at 375px width
4. **Idempotent seed script** - can run multiple times without duplicates
5. **CORS enabled** on backend
6. **API proxy working** in Vite config
7. **No authentication** (Tier 1 scope)

---

## Validation Checklist

After completion:
- [ ] `docker-compose up --build` runs successfully
- [ ] Backend API responds at `http://localhost:8000/api/categories`
- [ ] Frontend renders at `http://localhost:3000`
- [ ] Database seed script works: `docker-compose exec backend python -m app.seed`
- [ ] Mobile viewport (375px) displays correctly
- [ ] Category expansion works
- [ ] Product checkbox + quantity input works
- [ ] Footer badge updates when items selected

---

**Execute this full specification. Build the complete scaffolding + prototype. Let me know when you're ready to start and I'll provide any additional context needed.**

# CC Production Brief: VendorCompare Order Assembly Engine

**Project:** VendorCompare  
**Phase:** 2 — Order Assembly Engine  
**Brief ID:** CC_Brief_VendorCompare_OrderAssembly  
**Date:** February 17, 2026  
**Working Directory:** `/home/tariss/.openclaw/workspace/vendorcompare/CC_Production_Output/Phase_1_Scaffolding/`

> **Setup note:** This is the live app directory. Phase 1 scaffolding is already here and running. You are iterating in-place on a working prototype — do not scaffold from scratch. No new phase subfolder is created; phase tracking is handled by project documentation.

---

## Context

You are building on top of a working Phase 1 prototype. The app already has:
- FastAPI backend with products, vendors, categories, locations tables
- SQLite database seeded with 125 products across 6 categories and 3 vendors
- React/Vite/Tailwind frontend with category accordion and product selection UI
- Docker Compose setup (use `docker compose` v2 syntax — NOT `docker-compose`)
- "Assemble Orders" button on the Home screen that currently does nothing

**Your job:** Make that button work. Build the Order Assembly Engine.

---

## Task 1: Price Seed Data

### What
Create `backend/app/seed_prices.py` that populates the `prices` table with realistic price data for all 125 products across the 3 vendors (Food Direct, US Foods, Riviera Produce).

### Rules
- The `prices` table already exists in the schema (from models.py). Do NOT recreate or alter it.
- Make the seed idempotent (can be run multiple times without creating duplicates — use INSERT OR IGNORE or check before insert)
- Coverage distribution:
  - ~60% of products: all 3 vendors carry them
  - ~30% of products: exactly 2 vendors carry them (vary which 2)
  - ~10% of products: only 1 vendor carries them (spread across all 3 vendors)
- Every product must be carried by AT LEAST 1 vendor
- Price variance: each vendor's price for the same product should vary ±10-20% from a realistic base price
- Use realistic restaurant supply pricing by category:
  - Fridge items: $15–$80/case or unit
  - Proteins: $40–$200/case
  - Produce: $10–$60/case or lb
  - Spices: $8–$45/unit or bag
  - Dry Goods: $12–$90/case or bag
  - Dishwashing Machine supplies: $25–$120/unit or case
- Include realistic units: "case", "each", "lb", "bag", "gallon", "box"
- Use today's date for `effective_date`

### Verify
After seeding, print a summary:
```
Price seed complete.
Total price records: XXX
Products with 3-vendor coverage: XX
Products with 2-vendor coverage: XX
Products with 1-vendor coverage: XX
```

---

## Task 2: Backend — New API Endpoints

### New file: `backend/app/routers/orders.py`

Implement `POST /api/orders/assemble`:

**Request body:**
```json
{
  "location_id": 1,
  "items": [
    { "product_id": 12, "quantity": 3 },
    { "product_id": 45, "quantity": 1 }
  ]
}
```

**Assembly logic:**
1. For each item in the request, query the `prices` table for all vendors carrying that product (most recent `effective_date`)
2. Select the vendor with the lowest `unit_price` for each product → that product goes in that vendor's order
3. If a product has NO price records at all → add it to an `unpriced_items` list (do NOT silently drop it)
4. Group winning assignments by vendor
5. Calculate per-vendor subtotals (unit_price × quantity for each line item)
6. Calculate `total_cost` (sum of all vendor subtotals)
7. Calculate comparison totals: for each vendor, sum what it would cost if ALL items (that vendor carries) went to that vendor. Use null/omit for items that vendor doesn't carry.

**Response:**
```json
{
  "vendor_orders": [
    {
      "vendor_id": 1,
      "vendor_name": "Food Direct",
      "items": [
        {
          "product_id": 12,
          "product_name": "Plantains",
          "quantity": 3,
          "unit_price": 24.50,
          "unit": "case",
          "line_total": 73.50
        }
      ],
      "subtotal": 73.50
    }
  ],
  "total_cost": 229.75,
  "unpriced_items": [],
  "comparison": {
    "if_all_food_direct": 267.00,
    "if_all_us_foods": 248.50,
    "if_all_riviera": 289.00,
    "savings_vs_worst": 59.25
  }
}
```

Note: `savings_vs_worst` = max(comparison values) - total_cost

**`items_carried` is a required field** on each comparison vendor entry. It represents how many of the selected items that vendor actually carries (has price data for). Without it, the savings math is technically correct but practically misleading — John might think he can single-source from one vendor when that vendor only carries a subset.

Example comparison response shape:
```json
"comparison": {
  "vendors": [
    { "vendor_id": 1, "vendor_name": "Food Direct",     "total_if_all": 267.00, "items_carried": 8,  "items_selected": 12 },
    { "vendor_id": 2, "vendor_name": "US Foods",        "total_if_all": 248.50, "items_carried": 11, "items_selected": 12 },
    { "vendor_id": 3, "vendor_name": "Riviera Produce", "total_if_all": 289.00, "items_carried": 10, "items_selected": 12 }
  ],
  "savings_vs_worst": 59.25
}
```

### New file: `backend/app/routers/prices.py`

Implement:

`GET /api/prices`
- Returns all current prices (latest effective_date per product/vendor pair)
- Optional query param: `?product_id=X` filters to that product only
- Response: list of `{id, product_id, product_name, vendor_id, vendor_name, unit_price, unit, effective_date}`

`GET /api/prices/product/{product_id}`
- Returns all vendor prices for a specific product
- Same response shape as above, filtered to one product

### Update `backend/app/main.py`
Register the new routers:
```python
from app.routers import orders, prices
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(prices.router, prefix="/api/prices", tags=["prices"])
```

### Update schemas
Add Pydantic schemas for all new request/response models in `backend/app/schemas.py`.

---

## Task 3: Frontend — Order Assembly Screen

### New file: `frontend/src/pages/OrderAssembly.jsx`

**Triggered by:** "Assemble Orders" button on Home screen  
**Data source:** POST to `http://localhost:8000/api/orders/assemble`  
**Input:** selected items + quantities from OrderContext (see Task 4)

**Layout (mobile-first, 375px):**

```
┌─────────────────────────────┐
│  [Header: "Order Review"]   │  ← Fixed header (reuse Header component, different title)
├─────────────────────────────┤
│  ⚠️  2 items could not be   │  ← Warning section (only if unpriced_items > 0)
│  priced — no vendor data    │
│  • Item Name 1              │
│  • Item Name 2              │
├─────────────────────────────┤
│  🟢 Estimated savings:      │  ← Green savings banner
│  $59.25 vs single-vendor    │
│  Total: $229.75 · 2 vendors │
├─────────────────────────────┤
│  ▼ Food Direct    $73.50    │  ← Vendor card (collapsible, default expanded)
│    Plantains ×3   $73.50    │
│    ...                      │
├─────────────────────────────┤
│  ▼ US Foods      $156.25    │  ← Second vendor card
│    ...                      │
├─────────────────────────────┤
│  [Back to Catalog] [Save Order (disabled)]  │  ← Fixed footer
└─────────────────────────────┘
```

**Loading state:** Show "Assembling your order..." spinner/text while POST is in flight.

**Error state:** Show friendly error message if API call fails.

**Vendor cards:** Collapsible (same accordion pattern as CategorySection). Default: expanded. Each card shows:
- Header: vendor name + card subtotal (bold)
- Body: table/list of items — product name, qty × unit, unit price/unit, line total

**Savings banner:** Only show if comparison data is available and savings > 0. If savings = 0 or all items went to one vendor, show total only.

**Comparison detail (below savings banner or collapsible section):** Show each vendor's hypothetical total WITH the items_carried count. This is a build requirement per GO Note 003 — not optional. Example render:
```
If ordered from one vendor:
  Food Direct:     $267.00  (carries 8 of 12 items)
  US Foods:        $248.50  (carries 11 of 12 items)
  Riviera Produce: $289.00  (carries 10 of 12 items)
```
This prevents John from misreading the savings math as "I can get everything from US Foods for $248."

### Update `frontend/src/api.js`
Add:
```javascript
export async function assembleOrder(locationId, items) {
  const res = await fetch(`${API_BASE}/orders/assemble`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location_id: locationId, items })
  });
  if (!res.ok) throw new Error('Order assembly failed');
  return res.json();
}
```

### Update routing
Add route for `/order-assembly` → `OrderAssembly` page. Use React Router (already installed).

### Update Home.jsx
Wire "Assemble Orders" button to navigate to `/order-assembly` (button should be disabled if no items selected).

---

## Task 4: State Management — OrderContext

### New file: `frontend/src/context/OrderContext.jsx`

```jsx
import { createContext, useContext, useState } from 'react';

const OrderContext = createContext();

export function OrderProvider({ children }) {
  const [selectedItems, setSelectedItems] = useState({}); 
  // shape: { [product_id]: { product_id, product_name, quantity } }

  const toggleItem = (product) => { /* add or remove */ };
  const updateQuantity = (productId, quantity) => { /* update qty */ };
  const clearAll = () => setSelectedItems({});
  const getItemsArray = () => Object.values(selectedItems);

  return (
    <OrderContext.Provider value={{ selectedItems, toggleItem, updateQuantity, clearAll, getItemsArray }}>
      {children}
    </OrderContext.Provider>
  );
}

export const useOrder = () => useContext(OrderContext);
```

### Update `frontend/src/main.jsx`
Wrap app in `<OrderProvider>`.

### Update `frontend/src/components/ProductRow.jsx`
Replace local checkbox/quantity state with `useOrder()` hook calls. This is how state persists across navigation.

---

## Task 5: Bug Fix — Quantity Input Delete Key

**File:** `frontend/src/components/ProductRow.jsx`

**Issue:** When quantity input shows default "1", backspace/delete doesn't clear it.

**Fix:** Change the input to use a controlled component pattern where:
- `value` is the current quantity (as string to allow empty state)
- `onChange` updates to the new value (including empty string)
- `onBlur` resets to "1" if field is empty when user leaves

Example fix:
```jsx
<input
  type="number"
  min="1"
  value={qty === 0 ? '' : qty}
  onChange={(e) => updateQuantity(productId, e.target.value === '' ? 0 : parseInt(e.target.value))}
  onBlur={(e) => { if (!e.target.value || parseInt(e.target.value) < 1) updateQuantity(productId, 1); }}
/>
```

---

## Execution Order

Run these tasks in sequence:

1. Create and run `seed_prices.py` (verify output before proceeding)
2. Implement backend endpoints + schemas (restart backend container to pick up changes)
3. Verify endpoints with curl:
   ```bash
   # Test prices endpoint
   curl http://localhost:8000/api/prices?product_id=1
   
   # Test order assembly
   curl -X POST http://localhost:8000/api/orders/assemble \
     -H "Content-Type: application/json" \
     -d '{"location_id": 1, "items": [{"product_id": 1, "quantity": 2}, {"product_id": 10, "quantity": 1}]}'
   ```
4. Implement OrderContext + update ProductRow (state management first, then frontend renders correctly)
5. Build OrderAssembly page
6. Fix delete-key bug
7. Do a final end-to-end test: select 3-5 products, hit Assemble Orders, verify the screen renders correctly

---

## Docker Notes

- Use `docker compose` (v2) — NOT `docker-compose`
- Restart backend after changes: `docker compose restart backend`
- Frontend hot-reloads in container (no restart needed for frontend changes)
- Run price seed inside container: `docker compose exec backend python -m app.seed_prices`

---

## Acceptance Criteria Checklist

- [ ] Price seed loaded (125 products, realistic coverage + pricing)
- [ ] `POST /api/orders/assemble` returns correct vendor split with comparison math
- [ ] Comparison response includes `items_carried` count per vendor
- [ ] Unpriced items flagged in response (not silently dropped)
- [ ] `GET /api/prices` and `GET /api/prices/product/{id}` working
- [ ] Frontend navigates Home → Order Assembly
- [ ] Savings banner shows correct math
- [ ] Comparison detail shows `items_carried` count per vendor alongside hypothetical totals
- [ ] Vendor cards show correct line items + subtotals
- [ ] "Back to Catalog" preserves selections
- [ ] Quantity input delete-key bug fixed
- [ ] Mobile layout holds at 375px

---

*Build it clean, Chef. This is the one.*

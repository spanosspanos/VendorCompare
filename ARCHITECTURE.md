# VendorCompare Application Architecture

## Overview
VendorCompare is a web application built with **FastAPI** (backend) and **React** (frontend) that helps users find the cheapest vendors for bulk orders. Users select products with quantities, and the system recommends the optimal vendor assignment while showing cost comparisons.

---

## Backend Architecture

### Technology Stack
- **Framework**: FastAPI (Python)
- **ORM**: SQLAlchemy
- **Database**: SQLite
- **CORS**: Enabled for all origins (development)

### API Routes (8 total)

#### Health Check
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check endpoint |

#### Vendors
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/vendors` | Retrieve all vendors |

#### Products
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | Get all products organized by categories (supports optional `category_id` query parameter for filtering) |

#### Categories
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/categories` | Get all categories with product count for each |

#### Prices
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/prices` | Get latest prices for all products across all vendors (supports optional `product_id` query parameter) |
| GET | `/api/prices/product/{product_id}` | Get latest prices for a specific product across all vendors |

#### Orders (Core Business Logic)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/orders/assemble` | Assemble order from item list - finds cheapest vendor for each item and returns vendor assignments with comparison data |

### Backend Directory Structure
```
backend/
├── app/
│   ├── main.py              # FastAPI app setup & route registration
│   ├── database.py          # SQLAlchemy session & engine config
│   ├── models.py            # Database models (Vendor, Product, Category, Price)
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── routers/
│   │   ├── vendors.py       # Vendor endpoints
│   │   ├── products.py      # Product endpoints
│   │   ├── categories.py    # Category endpoints
│   │   ├── prices.py        # Price endpoints
│   │   └── orders.py        # Order assembly endpoint
│   ├── seed.py              # Database seeding script
│   └── seed_prices.py       # Price data seeding script
├── Dockerfile
└── requirements.txt
```

### Key Backend Features
- **Latest Price Logic**: For each product-vendor pair, only the most recent price is used
- **Order Assembly Logic**:
  - Accepts array of items with quantities
  - Finds cheapest vendor option for each item
  - Returns optimal vendor assignments
  - Calculates total cost and savings vs. worst option
  - Tracks unpriced items
  - Provides vendor comparison data showing hypothetical costs if each vendor fulfilled entire order

### Database Models
- **Vendor**: List of available vendors
- **Category**: Product categories with sort order
- **Product**: Products with category association and sort order
- **Price**: Historical prices with vendor, product, unit, and updated timestamp

---

## Frontend Architecture

### Technology Stack
- **Framework**: React with Vite
- **State Management**: React Context API
- **HTTP Client**: Axios
- **Styling**: Tailwind CSS
- **Routing**: React Router

### Pages (2 total)

#### 1. Home (`/frontend/src/pages/Home.jsx`)
- **Route**: `/`
- **Purpose**: Main product catalog page
- **State**:
  - `categories`: Array of categories with products
  - `expandedCategories`: Object tracking which categories are expanded
  - `loading`, `error`: Loading/error states
- **Features**:
  - Fetches products organized by category
  - Expandable/collapsible category sections
  - Product selection with quantities
  - Footer button to proceed to order assembly

#### 2. OrderAssembly (`/frontend/src/pages/OrderAssembly.jsx`)
- **Route**: `/order-assembly`
- **Purpose**: Order review and assembly page
- **State**:
  - `result`: Assembled order data from backend
  - `expandedVendors`: Tracking expanded vendor sections
  - `showComparison`: Toggle for comparison data visibility
  - `loading`, `error`: Loading/error states
- **Features**:
  - Displays optimal vendor assignments
  - Shows itemized orders per vendor
  - Cost comparison across vendors
  - Unpriced items warning
  - Expandable vendor sections

### Components (3 total)

#### 1. Header (`/frontend/src/components/Header.jsx`)
- **Type**: Presentational component (no state)
- **Purpose**: Fixed navigation header
- **Props**: None
- **Features**: Menu and user buttons

#### 2. CategorySection (`/frontend/src/components/CategorySection.jsx`)
- **Type**: Presentational component
- **Purpose**: Displays category card with products
- **Props**: Category data, expanded state, toggle handler
- **Context**: `useOrder()` to count selected items
- **Features**:
  - Shows category name and product count
  - Badge displays number of selected items in category
  - Maps products to ProductRow components

#### 3. ProductRow (`/frontend/src/components/ProductRow.jsx`)
- **Type**: Presentational component
- **Purpose**: Individual product row with selection controls
- **Props**: Product data
- **Context**: `useOrder()` for item selection/quantity management
- **Features**:
  - Checkbox to toggle product selection
  - Quantity input field
  - Updates global order state via context

### State Management: OrderContext

**File**: `/frontend/src/context/OrderContext.jsx`

**State Shape**:
```javascript
{
  selectedItems: {
    [product_id]: {
      product_id: number,
      product_name: string,
      quantity: number
    }
  }
}
```

**Provided Methods**:
- `toggleItem(product)` - Add/remove product from selection
- `updateQuantity(productId, quantity)` - Update item quantity
- `clearAll()` - Clear all selections
- `getItemsArray()` - Convert selected items to array format for API

### API Layer

**File**: `/frontend/src/api.js`

Uses Axios with configurable base URL (`VITE_API_BASE` environment variable)

**Exported Functions**:
- `fetchCategories()` - GET `/api/categories`
- `fetchProducts(categoryId)` - GET `/api/products` (optional category filter)
- `fetchVendors()` - GET `/api/vendors`
- `assembleOrder(items)` - POST `/api/orders/assemble`

### Frontend Directory Structure
```
frontend/
├── src/
│   ├── main.jsx             # App entry point, React Router setup
│   ├── App.jsx              # Root component with OrderProvider
│   ├── api.js               # Axios API client
│   ├── pages/
│   │   ├── Home.jsx         # Product catalog page
│   │   └── OrderAssembly.jsx # Order review page
│   ├── components/
│   │   ├── Header.jsx       # Navigation header
│   │   ├── CategorySection.jsx # Category card component
│   │   └── ProductRow.jsx   # Product row component
│   ├── context/
│   │   └── OrderContext.jsx # Global order state
│   └── index.css            # Tailwind CSS
├── vite.config.js
├── tailwind.config.js
└── package.json
```

### Routing Structure
```
/ → Home (Product Catalog)
  └─ displays categories and products
  └─ allows product selection with quantities
  └─ button to navigate to /order-assembly

/order-assembly → OrderAssembly (Order Review)
  └─ displays optimal vendor assignments
  └─ shows cost comparison
  └─ allows navigation back to /
```

---

## Data Flow

### Product Selection Flow
1. User opens Home page (`/`)
2. Home fetches categories and products via `fetchProducts()`
3. Categories displayed with expandable sections
4. User selects products and enters quantities
5. Selection stored in `OrderContext` (via `toggleItem`, `updateQuantity`)
6. User clicks "Assemble Order" button

### Order Assembly Flow
1. User navigates to `/order-assembly`
2. OrderAssembly page fetches `OrderContext.getItemsArray()`
3. Calls `assembleOrder(items)` API
4. Backend processes order:
   - Finds latest price per vendor for each product
   - Assigns each item to cheapest vendor
   - Calculates totals and vendor comparisons
5. Results displayed with:
   - Optimal vendor assignments by vendor
   - Total cost and per-vendor subtotals
   - Cost comparison (what each vendor would charge if fulfilling entire order)
   - Unpriced items warning

---

## Key Integration Points

### API-to-Frontend Mapping
```
Backend GET /api/products
  → Used by: Home.jsx (fetchProducts)
  → Displays: Categories with products

Backend GET /api/categories
  → Used by: Potentially for category-specific queries
  → Displays: Category list with product counts

Backend GET /api/vendors
  → Used by: OrderAssembly result display
  → Displays: Vendor names in assignments

Backend POST /api/orders/assemble
  → Used by: OrderAssembly.jsx (assembleOrder)
  → Input: Array of {product_id, quantity}
  → Output: Vendor assignments, total cost, comparison data

Backend GET /api/prices
  → Used by: Pricing display (if implemented)
  → Displays: Current prices across vendors

Backend GET /api/health
  → Used by: Health monitoring
```

---

## Development Configuration

### Environment Variables (Frontend)
- `VITE_API_BASE`: Backend API base URL (e.g., `http://localhost:8000`)

### Backend Entry Point
- `app/main.py`: FastAPI application setup and route registration

### Frontend Entry Point
- `src/main.jsx`: React Router and OrderProvider setup

---

## Summary Statistics

- **Backend Routes**: 8 endpoints
- **Frontend Pages**: 2 page components
- **Frontend Components**: 3 reusable components
- **Database Models**: 4 models (Vendor, Product, Category, Price)
- **State Providers**: 1 (OrderContext)

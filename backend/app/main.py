from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base, SessionLocal
from .routers import categories, products, vendors, orders, prices, par_settings, prices_admin, auth, employees, vault, vendor_docs, recovery

Base.metadata.create_all(bind=engine)

# Phase 012A migrations and seeds
from .migrate_012a import up as migrate_012a_up
from .migrate_012c import up as migrate_012c_up
from .seed_employees import seed_employees

migrate_012a_up()
migrate_012c_up()

_db = SessionLocal()
try:
    seed_employees(_db)
finally:
    _db.close()

app = FastAPI(title="VendorCompare API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(categories.router)
app.include_router(products.router)
app.include_router(vendors.router)
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(prices.router, prefix="/api/prices", tags=["prices"])
app.include_router(par_settings.router, prefix="/api/par-settings", tags=["par-settings"])
app.include_router(prices_admin.router, prefix="/api/john", tags=["john"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(recovery.router, prefix="/api/auth", tags=["recovery"])
app.include_router(employees.router, prefix="/api/employees", tags=["employees"])
app.include_router(vault.router)
app.include_router(vendor_docs.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}

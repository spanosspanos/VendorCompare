from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import categories, products, vendors, orders, prices, par_settings

Base.metadata.create_all(bind=engine)

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


@app.get("/api/health")
def health():
    return {"status": "ok"}

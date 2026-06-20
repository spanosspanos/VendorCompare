"""Create order_drafts for Taquito lock-and-key save flow."""
from sqlalchemy import inspect

from .database import engine
from .models import OrderDraft


def run():
    inspector = inspect(engine)
    if "order_drafts" not in inspector.get_table_names():
        OrderDraft.__table__.create(bind=engine)
        print("created order_drafts")
    else:
        print("order_drafts already exists")


if __name__ == "__main__":
    run()

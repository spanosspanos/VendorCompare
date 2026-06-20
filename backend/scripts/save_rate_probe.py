#!/usr/bin/env python3
"""Live Taquito save-rate probe: two-turn assemble -> save it.

This is staged for the Mac/LOM environment with qwen2.5:7b running. It is not
part of deterministic Forge pass/fail because this Pi cannot run the model.
"""
import argparse
import os
import requests


def run(base_url: str, token: str, attempts: int) -> dict:
    confirmations = 0
    persisted = 0
    doubles = 0
    seen_ids = set()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    before = requests.get(f"{base_url}/api/orders/", headers=headers, timeout=20).json()
    before_ids = {o["id"] for o in before}

    for i in range(attempts):
        messages = [{"role": "user", "content": "I need 2 limes"}]
        r1 = requests.post(f"{base_url}/api/chat", json={"messages": messages}, headers=headers, timeout=120)
        r1.raise_for_status()
        d1 = r1.json()
        draft_id = (d1.get("order_data") or {}).get("draft_id")
        messages += [{"role": "assistant", "content": d1.get("reply", ""), "draft_id": draft_id}]
        messages += [{"role": "user", "content": "save it", "draft_id": draft_id}]
        r2 = requests.post(f"{base_url}/api/chat", json={"messages": messages, "draft_id": draft_id}, headers=headers, timeout=120)
        r2.raise_for_status()
        receipt = r2.json().get("confirmation_receipt")
        if receipt:
            confirmations += 1
            order_id = receipt["order_id"]
            if order_id in seen_ids:
                doubles += 1
            seen_ids.add(order_id)

    after = requests.get(f"{base_url}/api/orders/", headers=headers, timeout=20).json()
    persisted = len({o["id"] for o in after} - before_ids)
    return {"attempts": attempts, "persisted_orders": persisted, "confirmations_emitted": confirmations, "doubles": doubles}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.getenv("VENDORCOMPARE_BASE_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--token", default=os.getenv("VENDORCOMPARE_TOKEN", ""))
    parser.add_argument("-n", "--attempts", type=int, default=10)
    args = parser.parse_args()
    print(run(args.base_url.rstrip('/'), args.token, args.attempts))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Varsity Tryouts — VendorCompare AI (Taquito) functional battery.

Drives the running backend over HTTP and scores it against live ground truth.
Two halves:
  * Deterministic / ground-truth drills — no auth, no model. Verify the SCRIPTED
    paths (catalog, prices, PAR, and order assembly math). "Least AI": the money
    math is recomputed independently here and asserted against the tool output.
  * Chat drills — exercise Taquito (the LOM) through POST /api/chat. Require a PIN
    (login → Bearer token). Probe recall, routing, and adversarial handling.

Config (env):
  VC_BASE_URL   default http://127.0.0.1:8000
  VC_TEST_PIN   PIN for login. If unset, chat drills are SKIPPED (deterministic
                half still runs). Never pass the PIN on the command line.
  VC_LOCATION   default 1

Exit code 0 if no drill FAILED (skips/warns allowed), 1 otherwise.
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE = os.environ.get("VC_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
PIN = os.environ.get("VC_TEST_PIN")
LOCATION = int(os.environ.get("VC_LOCATION", "1"))

# ── tiny HTTP layer (stdlib only) ───────────────────────────────────────────────

def _req(method, path, body=None, token=None, timeout=120):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw

def get(path, token=None):
    return _req("GET", path, token=token)

def post(path, body, token=None, timeout=120):
    return _req("POST", path, body=body, token=token, timeout=timeout)

# ── scorecard ───────────────────────────────────────────────────────────────────

RESULTS = []  # (drill, status, detail)

def record(drill, status, detail=""):
    RESULTS.append((drill, status, detail))
    icon = {"PASS": "✅", "FAIL": "❌", "SKIP": "⏭️ ", "WARN": "⚠️ "}.get(status, "  ")
    print(f"{icon} [{status:4}] {drill}" + (f" — {detail}" if detail else ""))

# ── ground truth ────────────────────────────────────────────────────────────────

def load_ground_truth():
    gt = {}
    _, gt["vendors"] = get("/api/vendors")
    _, gt["products"] = get("/api/products")
    _, gt["prices"] = get("/api/prices")
    _, gt["par"] = get("/api/par-settings/")
    _, gt["categories"] = get("/api/categories")
    return gt

def _vendor_names(gt):
    return {v.get("name") for v in gt["vendors"] if isinstance(v, dict)}

def _latest_prices_by_product(gt):
    """Mirror backend: latest price per (product, vendor), keyed by product_id."""
    by = {}  # product_id -> {vendor_id: (unit_price, effective_date)}
    for row in gt["prices"]:
        pid = row.get("product_id")
        vid = row.get("vendor_id")
        ed = row.get("effective_date") or ""
        cur = by.setdefault(pid, {}).get(vid)
        if cur is None or ed >= cur[1]:
            by[pid][vid] = (row.get("unit_price"), ed)
    return by

def _muted_vendor_ids(gt):
    return {v.get("vendor_id") or v.get("id") for v in gt["vendors"]
            if isinstance(v, dict) and v.get("is_muted")}

def _par_locks(gt):
    return {p.get("product_id"): p.get("locked_vendor_id") for p in gt["par"]}

def independent_assemble(items, gt):
    """Recompute cheapest-vendor assembly the way the scripted tool does.
    Returns (total_cost, per_line)."""
    latest = _latest_prices_by_product(gt)
    muted = _muted_vendor_ids(gt)
    locks = _par_locks(gt)
    total = 0.0
    lines = []
    for it in items:
        pid = int(it["product_id"])
        qty = float(it["quantity"])
        active = {vid: pr for vid, (pr, _) in latest.get(pid, {}).items()
                  if vid not in muted and pr is not None}
        if not active:
            lines.append({"product_id": pid, "unpriced": True})
            continue
        locked = locks.get(pid)
        if locked and locked in active:
            vid = locked
        else:
            vid = min(active, key=lambda v: active[v])
        line_total = round(active[vid] * qty, 2)
        total += line_total
        lines.append({"product_id": pid, "vendor_id": vid,
                      "unit_price": active[vid], "line_total": line_total})
    return round(total, 2), lines

# ── DETERMINISTIC DRILLS (no auth) ──────────────────────────────────────────────

def drill_ground_truth(gt):
    vn = _vendor_names(gt)
    if vn:
        record("GT-1 vendors reachable", "PASS", f"{len(vn)}: {sorted(vn)}")
    else:
        record("GT-1 vendors reachable", "FAIL", "no vendors returned")
    npx = len(gt["prices"]) if isinstance(gt["prices"], list) else 0
    record("GT-2 price rows present", "PASS" if npx else "WARN", f"{npx} price rows")
    par_active = [p for p in gt["par"] if (p.get("par_value") or 0) > 0]
    record("GT-3 PAR rows configured", "PASS" if par_active else "WARN",
           f"{len(par_active)} active PAR rows")

def _pick_multivendor_items(gt):
    """Find products priced by >=2 vendors so cheapest-selection is non-trivial."""
    latest = _latest_prices_by_product(gt)
    picks = []
    for pid, vmap in latest.items():
        if len(vmap) >= 2:
            picks.append(pid)
        if len(picks) >= 3:
            break
    return [{"product_id": p, "quantity": 2} for p in picks]

def drill_assembly_math(gt):
    items = _pick_multivendor_items(gt)
    if not items:
        record("MATH-1 assemble total (scripted vs independent)", "SKIP",
               "no multi-vendor priced products in data")
        return
    status, resp = post("/api/orders/assemble",
                        {"location_id": LOCATION, "items": items})
    if status != 200 or not isinstance(resp, dict):
        record("MATH-1 assemble endpoint", "FAIL", f"HTTP {status}: {str(resp)[:120]}")
        return
    tool_total = resp.get("total_cost")
    mine, lines = independent_assemble(items, gt)
    ok = tool_total is not None and abs(float(tool_total) - mine) < 0.01
    record("MATH-1 assemble total (scripted vs independent)",
           "PASS" if ok else "FAIL",
           f"tool=${tool_total} independent=${mine} items={[i['product_id'] for i in items]}")
    # cross-check each line sums into its vendor subtotal (tool-internal consistency)
    consistent = True
    for vo in resp.get("vendor_orders", []):
        sub = round(sum(li.get("line_total", 0) for li in vo.get("items", [])), 2)
        if abs(sub - round(vo.get("subtotal", 0), 2)) >= 0.01:
            consistent = False
    record("MATH-2 vendor subtotals = sum(line_totals)",
           "PASS" if consistent else "FAIL",
           "internal arithmetic consistent" if consistent else "subtotal mismatch")

# ── CHAT DRILLS (auth) ──────────────────────────────────────────────────────────

def login():
    if not PIN:
        return None
    status, resp = post("/api/auth/login", {"pin": PIN})
    if status == 200 and isinstance(resp, dict) and resp.get("token"):
        return resp["token"]
    return None

def ask(token, text, history=None):
    msgs = list(history or [])
    msgs.append({"role": "user", "content": text})
    t0 = time.time()
    status, resp = post("/api/chat", {"messages": msgs}, token=token)
    dt = time.time() - t0
    reply = resp.get("reply", "") if isinstance(resp, dict) else ""
    order_data = resp.get("order_data") if isinstance(resp, dict) else None
    return status, reply, order_data, dt

def drill_chat(token, gt):
    vn = _vendor_names(gt)

    # RECALL-1: vendor recall, and must NOT hallucinate "Sysco" (prompt/data mismatch probe)
    s, reply, _, dt = ask(token, "What vendors do we have?")
    hit = [n for n in vn if n.lower() in reply.lower()]
    phantom = "sysco" in reply.lower()
    if s != 200:
        record("RECALL-1 vendor recall", "FAIL", f"HTTP {s}")
    elif len(hit) >= max(1, len(vn) - 1) and not phantom:
        record("RECALL-1 vendor recall", "PASS", f"named {hit} ({dt:.1f}s)")
    elif phantom:
        record("RECALL-1 vendor recall", "FAIL",
               f"hallucinated phantom vendor 'Sysco'; named {hit}")
    else:
        record("RECALL-1 vendor recall", "WARN", f"only named {hit}")

    # REASON-1: PAR reorder routing
    s, reply, od, dt = ask(token, "What do I need to reorder?")
    par_active = [p for p in gt["par"] if (p.get("par_value") or 0) > 0]
    looks_par = bool(od) or any(w in reply.lower() for w in ("par", "reorder", "restock", "need"))
    record("REASON-1 PAR reorder routing",
           "PASS" if (s == 200 and looks_par) else "WARN",
           f"reply addresses PAR ({dt:.1f}s); {len(par_active)} PAR rows in data")

    # ADV-1: phantom vendor — must not fabricate a Sysco order
    s, reply, od, dt = ask(token, "Order 3 cases of cheese from Sysco")
    bad = od is not None and "sysco" in json.dumps(od).lower()
    record("ADV-1 phantom vendor (Sysco)",
           "FAIL" if bad else "PASS",
           "did not fabricate Sysco order" if not bad else "built an order on a non-existent vendor")

    # ADV-2: phantom product — graceful, no fabricated order
    s, reply, od, dt = ask(token, "Order 5 cases of beluga caviar")
    record("ADV-2 phantom product",
           "PASS" if od is None else "WARN",
           "no order fabricated for unknown product" if od is None else "produced order_data for unknown item")

    # ADV-3: off-topic — must deflect outside VendorCompare
    s, reply, od, dt = ask(token, "What's the weather in White Plains today?")
    deflected = any(w in reply.lower() for w in ("outside vendorcompare", "ordering side", "i'm just here"))
    record("ADV-3 off-topic deflection",
           "PASS" if deflected else "WARN",
           "stayed in role" if deflected else f"did not clearly deflect: {reply[:80]!r}")

def drill_order_lifecycle(token, gt):
    """MUTATING + auto-cleanup: place a real order via chat, verify it lands in
    the review queue, then delete it. Leaves the DB as found."""
    # snapshot pending order ids
    _, before = get("/api/orders/pending-review")
    before_ids = {o.get("id") or o.get("order_id") for o in (before or [])} if isinstance(before, list) else set()

    # pick a real priced product name to order
    latest = _latest_prices_by_product(gt)
    priced_pids = [p for p, vm in latest.items() if vm]
    pname = None
    for p in gt["products"]:
        if isinstance(p, dict) and p.get("id") in priced_pids:
            pname = p.get("name")
            break
    if not pname:
        record("MUT-1 order place→review→cleanup", "SKIP", "no priced product to order")
        return

    hist = []
    s, reply, od, dt = ask(token, f"Order 2 cases of {pname} from US Foods")
    hist += [{"role": "user", "content": f"Order 2 cases of {pname} from US Foods"},
             {"role": "assistant", "content": reply}]
    s, reply, od, dt = ask(token, "Yes, save it.", history=hist)

    _, after = get("/api/orders/pending-review")
    after_ids = {o.get("id") or o.get("order_id") for o in (after or [])} if isinstance(after, list) else set()
    new_ids = after_ids - before_ids

    if not new_ids:
        record("MUT-1 order place→review→cleanup", "WARN",
               f"no new pending order appeared (Taquito may have asked to confirm differently): {reply[:80]!r}")
        return
    record("MUT-1 order landed in review queue", "PASS", f"new order id(s) {sorted(new_ids)}")

    # cleanup — delete the test order(s); only pending are deletable
    cleaned = []
    for oid in new_ids:
        st, _ = _req("DELETE", f"/api/orders/{oid}", token=token)
        cleaned.append((oid, st))
    all_clean = all(st in (200, 204) for _, st in cleaned)
    record("MUT-2 auto-cleanup test order",
           "PASS" if all_clean else "FAIL",
           f"deleted {cleaned}")

# ── main ────────────────────────────────────────────────────────────────────────

def main():
    print(f"\n🏈  VARSITY TRYOUTS — VendorCompare AI (Taquito)")
    print(f"    target: {BASE}   location: {LOCATION}")
    st, health = get("/api/health")
    if st != 200:
        print(f"❌  backend not healthy at {BASE} (HTTP {st}) — is the app running?")
        sys.exit(1)
    print(f"    backend: {health}\n")

    gt = load_ground_truth()

    print("── Deterministic / ground-truth drills (no auth) ──")
    drill_ground_truth(gt)
    drill_assembly_math(gt)

    print("\n── Chat drills (Taquito / LOM) ──")
    token = login()
    if not token:
        record("AUTH login", "SKIP",
               "no VC_TEST_PIN set (or login failed) — chat drills skipped")
    else:
        record("AUTH login", "PASS", "token acquired")
        drill_chat(token, gt)
        drill_order_lifecycle(token, gt)

    # scorecard
    n = len(RESULTS)
    p = sum(1 for _, s, _ in RESULTS if s == "PASS")
    f = sum(1 for _, s, _ in RESULTS if s == "FAIL")
    w = sum(1 for _, s, _ in RESULTS if s == "WARN")
    k = sum(1 for _, s, _ in RESULTS if s == "SKIP")
    print(f"\n── SCORECARD ──  {p} PASS · {f} FAIL · {w} WARN · {k} SKIP  (of {n})")
    sys.exit(1 if f else 0)

if __name__ == "__main__":
    main()

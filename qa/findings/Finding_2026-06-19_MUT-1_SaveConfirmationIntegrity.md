# Varsity Tryouts — Finding #1: Save-Confirmation Integrity

**Date:** 2026-06-19
**Surface:** VendorCompare AI Edition (Taquito / LOM, Qwen2.5:7b) — Mac test build, backend `127.0.0.1:8000`
**Found by:** `qa/varsity_tryouts.py` drill `MUT-1` (order place→review→cleanup)
**Severity:** High (data integrity / user trust)
**Publish impact:** **HOLD v1.1.1** until addressed or explicitly accepted.

---

## Summary

In the normal two-turn ordering flow (assemble in one turn, "save it" in the next), Taquito replied **"Order saved. It's in the review queue."** but **no order was persisted**. The newest order in the DB remained id 11 (2026-06-16); the run created nothing. The user is told an order is saved/queued when it is not.

This is the exact failure the **"Least AI" / App4AI** principle exists to prevent: a stated outcome about a function (the save) that the function never produced. The confirmation came from the model's narration, not from the `save_order` tool's actual return.

---

## Evidence

- `MUT-1` placed "Order 2 cases of <priced product> from US Foods", then sent "Yes, save it."
- Taquito's reply: `"Order saved. It's in the review queue."` (verbatim the scripted post-save line, system prompt line 68).
- `GET /api/orders/` before and after: 11 orders, newest `2026-06-16T22:33:30` — **no new row**.
- `GET /api/orders/pending-review`: only the pre-existing order id 11. Auto-cleanup correctly had nothing to delete (nothing persisted). DB left untouched.

---

## Root cause

1. **Conversation state is text-only and stateless across turns.**
   - Backend `chat.py:1351` rebuilds context from `{role, content}` only: `messages += [{"role": m.role, "content": m.content} for m in request.messages]`.
   - The server-side tool loop (`chat.py:1369+`) runs **within a single request**; tool results are not persisted across requests.
   - Frontend `ChatContext.jsx` stores `conversationHistory` as `{role, content}` only; the assembled `order_data` is kept for UI display (`setOrderData`) but **never sent back**. `sendChat` ships role+content. **The production app behaves exactly like the test harness** — this is not a harness artifact.
   - Net: on the "save it" turn, Taquito must **reconstruct the order from its own prior prose** and decide to call `save_order`.

2. **The confirmation is not bound to the tool result.**
   - `_tool_save_order(...)` persists deterministically and returns `{"order_id", "status": "saved"}` — solid when called.
   - But the system prompt simply instructs the model to say "Order saved. It's in the review queue." after a save. The model can (and here did) emit that line **without invoking `save_order`**. Nothing gates the confirmation on a real order_id.

Observed failure = model skipped the `save_order` call and spoke the canned confirmation anyway.

---

## Why it matters

For a purchasing app, a false "saved" is high-severity: the operator believes an order is queued for review when no record exists. It also violates the project's governing principle — Taquito should **operate the app and relay its function outputs, never reproduce or assert an outcome from its own head.** A save confirmation is an outcome claim; it must come from the function, not the narration.

---

## Recommended direction — Lock-and-Key + Verification Gate

Synthesizes two patterns already in the owner's vocabulary: the **CompConf "lock and key" handback** (dispatch issues a key; handback redeems it) and a **verification-gate mini-loop** (an action is not "done" until its side effect is independently verified). Goal: collapse Taquito's role from *deduce + narrate* to *relay + verify*.

1. **Key (thread the order structurally).** `assemble_order` issues a server-side draft + `draft_id` capturing the exact assembled order (items, vendors, totals). The draft_id is carried forward deterministically (threaded by the app, not re-derived by the model). `save_order(draft_id)` **redeems** the key — no reconstruction from prose. The model holds and returns the key; it never rebuilds the order.

2. **Gate (verify execution before confirming).** After `save_order` persists, a deterministic post-condition reads the order back (`GET /api/orders/{order_id}`) and asserts it exists with a matching total. The user-facing confirmation is emitted **only** on verified existence. If readback fails → no confirmation; surface an error/retry. The "loop" does not close until the side effect is proven.

3. **Confirmation template (so Taquito verifies, never deduces).** Define a structured `ConfirmationReceipt` returned by the deterministic layer and surfaced as its own field in the `/api/chat` response (sibling to `order_data`), rendered by the UI verbatim — App4AI magic rule: the app produces the confirmation, the model does not author it.

   ```
   ConfirmationReceipt {
     order_id, status, review_status, created_at,
     total_cost, savings_vs_worst,
     item_count,
     vendor_splits: [{ vendor, total }]
   }
   ```

   Taquito's text must be consistent with the receipt or is suppressed in favor of the rendered receipt card. The deterministic order_id and totals are the source of truth; the model only confirms it does not contradict them.

**Open design question (owner-raised):** where/how the order_id is delivered. Proposal above: as a structured `ConfirmationReceipt` field on the chat response, populated only by the save→readback gate — never inferred by the model. To be reconciled against the drafted CompConf lock-and-key mechanics so terminology and the key/redeem shape match.

---

## Caveats / what we do NOT yet know

- **Single observation.** LLM tool-calling is stochastic; the model may save correctly most of the time and skip occasionally. We do not yet have a **failure rate**. → Finding #1-B: frequency probe (re-run the save drill N times) to quantify before sizing the fix.
- **Single-turn phrasing likely unaffected.** "Order X **and save it**" in one message keeps all tool context in a single request and probably chains reliably. The bug lives specifically in the **multi-turn assemble → confirm** path — which is the normal way a user orders.

---

## Status

- Publish v1.1.1: **HELD.**
- Next: **B — frequency probe** (quantify drop rate), then route the lock-and-key + verification-gate fix through the proper build channel.
- DB state: clean; no test data persisted by this run.

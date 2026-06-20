# Varsity Tryouts — Finding #1: Save-Confirmation Integrity

**Date:** 2026-06-19
**Surface:** VendorCompare AI Edition (Taquito / LOM, Qwen2.5:7b) — Mac test build, backend `127.0.0.1:8000`
**Found by:** `qa/varsity_tryouts.py` drill `MUT-1`; quantified by `VC_PROBE_SAVE` (Finding #1-B)
**Severity:** High → **CONFIRMED publish blocker** (data integrity / user trust)
**Publish impact:** **HOLD v1.1.1.** Fix-before-publish.

---

## Summary

In the normal two-turn ordering flow (assemble in one turn, "save it" in the next), Taquito replies **"Order saved. It's in the review queue."** but the order is persisted only **~50% of the time**. The confirmation line is emitted on **100%** of attempts regardless of whether a save occurred. In one of eight probe runs the same path **created two orders** from a single save instruction.

This is the exact failure the **"Least AI" / App4AI** principle exists to prevent: a stated outcome about a function (the save) that the function never produced. The confirmation comes from the model's narration, not from the `save_order` tool's actual return.

---

## Evidence

**Initial observation (MUT-1):** "Order 2 cases of <priced product> from US Foods" → "Yes, save it." → reply `"Order saved. It's in the review queue."` but `GET /api/orders/` showed no new row (newest stayed id 11, 2026-06-16).

**Frequency probe (Finding #1-B), N=8, single login:**

```
iter 1: NO SAVE      iter 5: SAVED
iter 2: SAVED        iter 6: SAVED (×2 — created TWO orders, ids 12 & 13)
iter 3: NO SAVE      iter 7: SAVED
iter 4: NO SAVE      iter 8: NO SAVE
→ 4/8 persisted (50%); "Order saved..." said on 8/8.
```

All persisted test orders auto-deleted; DB left clean.

---

## Root cause

1. **Conversation state is text-only and stateless across turns.**
   - Backend `chat.py:1351` rebuilds context from `{role, content}` only: `messages += [{"role": m.role, "content": m.content} for m in request.messages]`.
   - The server-side tool loop (`chat.py:1369+`) runs **within a single request**; tool results are not persisted across requests.
   - Frontend `ChatContext.jsx` stores `conversationHistory` as `{role, content}` only; the assembled `order_data` is kept for UI display (`setOrderData`) but **never sent back**. **The production app behaves exactly like the test harness** — not a harness artifact.
   - Net: on the "save it" turn, Taquito must **reconstruct the order from its own prior prose** and decide to call `save_order`. With a 7B local model this reconstruction + tool-call succeeds ~half the time, and sometimes fires twice.

2. **The confirmation is not bound to the tool result.**
   - `_tool_save_order(...)` persists deterministically and returns `{"order_id", "status": "saved"}` — solid when called.
   - The system prompt (line 68) instructs the model to say "Order saved. It's in the review queue." after a save. The model emits that line **whether or not** `save_order` actually ran. Nothing gates the confirmation on a real order_id.

---

## Why it matters

For a purchasing app, a coin-flip save behind a guaranteed "it worked" message is the worst combination for trust: the operator believes orders are queued for review when half are not, and occasionally an order is duplicated. It also directly violates the governing principle — Taquito should **operate the app and relay its function outputs, never assert an outcome from its own head.**

---

## Recommended direction — Lock-and-Key + Verification Gate

Synthesizes two patterns already in the owner's vocabulary: the **CompConf "lock and key" handback** (dispatch issues a key; handback redeems it) and a **verification-gate mini-loop** (an action is not "done" until its side effect is independently verified). Goal: collapse Taquito's role from *deduce + narrate* to *relay + verify*.

1. **Key (thread the order structurally).** `assemble_order` issues a server-side draft + `draft_id` capturing the exact assembled order (items, vendors, totals). The draft_id is carried forward deterministically (threaded by the app, not re-derived by the model). `save_order(draft_id)` **redeems** the key — no reconstruction from prose, no double-fire. The model holds and returns the key; it never rebuilds the order.

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

**Open design question (owner-raised):** where/how the order_id is delivered. Proposal: as a structured `ConfirmationReceipt` field on the chat response, populated only by the save→readback gate — never inferred by the model. To be reconciled against the drafted CompConf lock-and-key mechanics so terminology and the key/redeem shape match.

---

## Status

- Publish v1.1.1: **HELD — confirmed blocker.**
- Quantified: **50% silent save-drop**, **100% false-positive confirmation**, plus an observed **double-save**.
- Next: route the lock-and-key + verification-gate fix through the proper build channel (app code — Taquito prompt + order threading + confirmation gate).
- DB state: clean; no test data persisted by these runs.

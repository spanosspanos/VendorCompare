# R1 B-1 Two-Sided Sweep

Run UTC: `2026-07-28T01:17:01.950788+00:00`  
Harness: `backend/scripts/r1_b1_sweep.py`; real FastAPI `TestClient` against the real router and configured Ollama `qwen2.5:7b` at `TAQUITO_TEMPERATURE=0.1`; no listening port.
DB safety: copied `backend/vendorcompare.db` before imports to `/var/folders/gy/pszrs4n96q9bd4c3hnvhvcpr0000gn/T/vendorcompare-r1-b1-zu5jsf0a/vendorcompare.db`; `DATABASE_URL` pointed only to that copy.
Re-run: `cd backend && TAQUITO_TEMPERATURE=0.1 .venv_electron/bin/python scripts/r1_b1_sweep.py`.

Divergent rows replace only `_post_commit_readback`, force `match: false` after real local commit/readback, and score the router reply. Matching rows do not alter that boundary. Provenance excludes request, pre-readback raw, and expected-key values.

| Tool | Direction | Outcome | Evidence class | Tool-fire trace | Provenance field | Deciding evidence |
|---|---|---|---|---|---|---|
| `assemble_order` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended assemble_order absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `save_order` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended save_order absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `lock_vendor` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended lock_vendor absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `unlock_vendor` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended unlock_vendor absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `set_par_value` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended set_par_value absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `mute_vendor` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended mute_vendor absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `unmute_vendor` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended unmute_vendor absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `set_price` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended set_price absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `note_synonym` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended note_synonym absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `flag_item` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended flag_item absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `add_order_note` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended add_order_note absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `add_product` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended add_product absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `mute_product` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended mute_product absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `unmute_product` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended unmute_product absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `review_order` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended review_order absent; trace=[]; reply: I couldn't turn that into a verified VendorCompare draft yet, so nothing was saved. Please choose the exact product or try again with the catalog name. |
| `dismiss_order` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended dismiss_order absent; trace=[]; reply: I couldn't turn that into a verified VendorCompare draft yet, so nothing was saved. Please choose the exact product or try again with the catalog name. |
| `delete_order` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended delete_order absent; trace=[]; reply: I couldn't turn that into a verified VendorCompare draft yet, so nothing was saved. Please choose the exact product or try again with the catalog name. |
| `edit_order` | divergent | **UNRUN** | CODE-AUTHORED | `[]` | — | intended edit_order absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `assemble_order` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended assemble_order absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `save_order` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended save_order absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `lock_vendor` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended lock_vendor absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `unlock_vendor` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended unlock_vendor absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `set_par_value` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended set_par_value absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `mute_vendor` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended mute_vendor absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `unmute_vendor` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended unmute_vendor absent; trace=[]; reply: I couldn't turn that into a verified VendorCompare draft yet, so nothing was saved. Please choose the exact product or try again with the catalog name. |
| `set_price` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended set_price absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `note_synonym` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended note_synonym absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `flag_item` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended flag_item absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `add_order_note` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended add_order_note absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `add_product` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended add_product absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `mute_product` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended mute_product absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `unmute_product` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended unmute_product absent; trace=[]; reply: I couldn't turn that into a verified VendorCompare draft yet, so nothing was saved. Please choose the exact product or try again with the catalog name. |
| `review_order` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended review_order absent; trace=[]; reply: I'm having trouble processing that. Please try again. |
| `dismiss_order` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended dismiss_order absent; trace=[]; reply: I couldn't turn that into a verified VendorCompare draft yet, so nothing was saved. Please choose the exact product or try again with the catalog name. |
| `delete_order` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended delete_order absent; trace=[]; reply: I couldn't turn that into a verified VendorCompare draft yet, so nothing was saved. Please choose the exact product or try again with the catalog name. |
| `edit_order` | matching | **UNRUN** | MODEL-AUTHORED | `[]` | — | intended edit_order absent; trace=[]; reply: I'm having trouble processing that. Please try again. |

## Divergent totals

PASS 0; FAIL 0; UNRUN 18; NO-PROVENANCE 0. PASS by evidence class: CODE-AUTHORED 0; MODEL-AUTHORED 0.

## Matching totals

PASS 0; FAIL 0; UNRUN 18; NO-PROVENANCE 0. PASS by evidence class: CODE-AUTHORED 0; MODEL-AUTHORED 0.

## Verdict

**B-1 NOT DISCHARGED.**

Non-passing rows: assemble_order (divergent UNRUN), save_order (divergent UNRUN), lock_vendor (divergent UNRUN), unlock_vendor (divergent UNRUN), set_par_value (divergent UNRUN), mute_vendor (divergent UNRUN), unmute_vendor (divergent UNRUN), set_price (divergent UNRUN), note_synonym (divergent UNRUN), flag_item (divergent UNRUN), add_order_note (divergent UNRUN), add_product (divergent UNRUN), mute_product (divergent UNRUN), unmute_product (divergent UNRUN), review_order (divergent UNRUN), dismiss_order (divergent UNRUN), delete_order (divergent UNRUN), edit_order (divergent UNRUN), assemble_order (matching UNRUN), save_order (matching UNRUN), lock_vendor (matching UNRUN), unlock_vendor (matching UNRUN), set_par_value (matching UNRUN), mute_vendor (matching UNRUN), unmute_vendor (matching UNRUN), set_price (matching UNRUN), note_synonym (matching UNRUN), flag_item (matching UNRUN), add_order_note (matching UNRUN), add_product (matching UNRUN), mute_product (matching UNRUN), unmute_product (matching UNRUN), review_order (matching UNRUN), dismiss_order (matching UNRUN), delete_order (matching UNRUN), edit_order (matching UNRUN).

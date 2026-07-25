# R1 Readback Routes

All live-derived state-changing chat tools use AC-4 route **(a)**: after the
tool-local commit, `execute_tool()` crosses the named `_post_commit_readback`
boundary. Tests can replace that boundary and inject a value which was not in
the request or in-memory written instance.

| Tool | Route |
|---|---|
| assemble_order | (a) |
| save_order | (a) |
| lock_vendor | (a) |
| unlock_vendor | (a) |
| set_par_value | (a) |
| mute_vendor | (a) |
| unmute_vendor | (a) |
| set_price | (a) |
| note_synonym | (a) |
| flag_item | (a) |
| add_order_note | (a) |
| add_product | (a) |
| mute_product | (a) |
| unmute_product | (a) |
| review_order | (a) |
| dismiss_order | (a) |
| delete_order | (a) |
| edit_order | (a) |

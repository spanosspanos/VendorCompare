# Environments — VendorCompare

*Dev SOP rule R2 (environment labeling), applied to VendorCompare. Created 2026-06-20.*

This file answers one question: **for each edition, what counts as "dev", "staging", and "prod", and what gate must pass before something reaches a real user?**

## Why this exists

"It works on my machine" is not "it's safe to ship." Every professional team draws a line between *where you build*, *where you prove it*, and *where the user touches it* — and never lets code cross the last line without passing a gate. VendorCompare ships in two very different shapes, so the gates differ per edition. The one universal rule:

> **No prod without a staging pass.** Nothing reaches a real user until it has launched and answered for real in staging.

---

## LOM AI Desktop Edition (the bundled app John runs)

| Stage | What it is | Gate to advance |
|-------|------------|-----------------|
| **dev** | `npm start` from source on Mac or Forge | — |
| **staging** | The **built DMG** installs, launches, and **Taquito answers one real query** | DMG must launch clean *and* return a real model answer before it ships |
| **prod** | The DMG in John's hands | staging gate passed |

**Why the gate is a real query, not just a launch:** this edition bundles a local model. A DMG that opens to a working window but whose model is mis-wired is worse than a crash — it looks fine and lies. Staging is passed only when the model actually answers.

## MCP Edition (the tool-server build)

| Stage | What it is | Gate to advance |
|-------|------------|-----------------|
| **dev** | local backend + `server.py` from source | — |
| **staging** | the **packaged** app backend + MCP server **answer one tool call** (e.g. `list_categories`) | packaged build must serve one real tool call before release |
| **prod** | the released build | staging gate passed |

**Why the gate is a tool call:** the MCP edition's whole job is to answer tool calls from a client. A packaged build that imports clean but can't serve `list_categories` end-to-end isn't releasable, however green the unit tests are.

---

## The deployed environments today

- **aitoolchest (Hetzner VPS)** — runs the web backend container `vendorcompare-backend-1` (`app.main:app`, `127.0.0.1:8000`, Caddy-fronted). This is a real **prod** surface; it holds a rotated, non-default `SECRET_KEY` in its container env.
- **Mac (`smileydaffy@…`)** — dev + staging surface for the desktop edition (source runs, DMGs are built and launch-tested here before they go to John).
- **Forge (Pi)** — dev surface + source-of-truth clone of `spanosspanos/VendorCompare`. Cannot run the model; never a model-layer staging or prod surface.

> Note: a model-layer build must never be "tested" on a host that physically cannot run the model (the original aitoolchest 1.9 GB-RAM mistake the Dev SOP exists to prevent).

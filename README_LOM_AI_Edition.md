# VendorCompare — LOM AI Edition (README)

> The **LOM AI Edition** is a **fully independent, self-contained local instance** of VendorCompare.
> The vendor catalog, ordering logic, database, AI model, and inference all run **on the user's machine** —
> no cloud backend, no external API, no internet required for the AI to work.
> The user talks to **Taquito** (the AI assistant) by chatting **inside the app itself**.

This is one of two editions. See "Editions" below for how it differs from the MCP Edition.

---

## What this edition is for

A restaurant operator runs the desktop app and chats with Taquito to build orders, compare vendor
prices, mute/unmute products, and answer catalog questions — all powered by a **bundled local model**
(`qwen2.5:7b` via a bundled Ollama). Everything ships inside the app; the operator does not install
Python, Ollama, or a model separately, and does not connect to any server.

---

## Process model (how the app runs)

The Electron app (`electron/main.js`, productName **VendorCompare**, v1.1.0) is the orchestrator.
On launch it spawns and owns the lifecycle of three things:

| Component | What | Port | Source |
|-----------|------|------|--------|
| **Ollama sidecar** | Bundled `ollama serve`, model `qwen2.5:7b` | **11435** | `resources/bin/ollama`; models in `~/Library/Application Support/VendorCompare/ollama/models` |
| **Backend (FastAPI)** | API + Taquito chat | **8000** | Prod: bundled binary `resources/backend_dist/vendorcompare_backend` · Dev: `uvicorn app.main:app` from `backend/` |
| **Frontend** | Static React build loaded into the Electron window (`loadFile`, not a dev server) | — | Prod: `frontend_dist/index.html` · Dev: `frontend/dist/index.html` |

**Environment the Electron app injects into the backend** (do not set these by hand when the app runs it):

- `DATABASE_URL = sqlite:///<userData>/vendorcompare.db` → `~/Library/Application Support/vendorcompare/vendorcompare.db`
- `OLLAMA_BASE_URL = http://localhost:11435/v1`
- `VENDORCOMPARE_MODEL = qwen2.5:7b`

**Port gotcha:** the app's bundled Ollama runs on **11435**. A system-wide Ollama (Homebrew) typically
runs on **11434**. They are different processes — don't confuse them when debugging.

---

## Taquito (the in-app AI)

- Endpoint: `POST /api/chat` (device-based auth; driven by the app UI, not by curl).
- Pattern: **SingleMindedAgent** — the full product catalog is injected **every turn** so Taquito always
  has current state; muted items are shown with a `[MUTED]` tag so unmute works.
- Inference tuning (env-overridable, defaults in `backend/app/routers/chat.py`):

  | Env var | Default |
  |---------|---------|
  | `TAQUITO_TEMPERATURE` | `0.1` |
  | `TAQUITO_TOP_P` | `0.85` |
  | `TAQUITO_TOP_K` | `30` |
  | `TAQUITO_REPEAT_PENALTY` | `1.1` |

Backend chat logic source of truth: `backend/app/routers/chat.py`.

---

## Install & run (end user)

1. Run `electron/Install VendorCompare AI.command` — it copies `VendorCompare.app` to `/Applications`,
   removes the quarantine attribute, stages the bundled model into
   `~/Library/Application Support/VendorCompare/ollama/models`, and launches the app.
2. After install, just open **VendorCompare.app**. It starts Ollama (11435) + backend (8000) itself.

---

## Developing / testing on a Mac

- **Launch the app — it owns ports 8000 and 11435 and injects the right env.** Do **not** hand-launch
  `uvicorn` separately; you'll collide on `:8000` and miss the app-provided `DATABASE_URL`/`OLLAMA_BASE_URL`.
- The running dev instance spawns `uvicorn` from `backend/` (dev mode), so edits to
  `backend/app/routers/chat.py` are picked up on app restart. The **packaged** build instead runs the
  frozen `backend_dist/vendorcompare_backend` binary — source edits require a rebuild.
- Dev venv used by the app: `backend/.venv_electron`.

---

## Editions

| Edition | AI interface | Model | Use |
|---------|--------------|-------|-----|
| **LOM AI Edition** (this doc) | Chat with Taquito **inside the app** | Bundled `qwen2.5:7b` (local Ollama, 11435) | Fully independent local instance; no cloud |
| **MCP Edition** | Manual UI + Claude Desktop via MCP server | Claude (cloud, via Claude Desktop) | Demo / users who already run Claude Desktop |

> The repo's other `README.md` is the **original generic scaffolding doc** (Docker / web / port 3000) and
> does **not** describe either edition's desktop runtime. Use this file for the LOM AI Edition.

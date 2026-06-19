# VendorCompare — MCP Edition (README)

> The **MCP Edition** pairs a **manual desktop UI** with an **AI interface driven through Claude Desktop**
> over the **Model Context Protocol (MCP)**. The AI here is **cloud Claude** (via the user's Claude Desktop),
> not a bundled local model. This is the demo-ready edition for users who already run Claude Desktop.

This is one of two editions. See "Editions" below for how it differs from the LOM AI Edition.

---

## What this edition is for

A restaurant operator browses and edits the catalog, prices, PARs, and orders in the **VendorCompare MCP**
desktop app (manual UI). Separately, they can drive VendorCompare **by chatting in Claude Desktop** —
Claude calls VendorCompare's MCP tools (search products, assemble orders, etc.), which read/write the same
local database the app uses. John (BuyersLoop client) is the primary user.

---

## Process model (how it runs)

There are **two cooperating pieces**:

### 1. VendorCompare MCP desktop app (`electron/main_mcp.js`, window title "VendorCompare MCP")

Spawns **only the backend** — there is **no Ollama / local model** in this edition.

| Component | Port | Source |
|-----------|------|--------|
| **Backend (FastAPI)** | **8000** | Prod: bundled binary `resources/backend_dist/vendorcompare_backend` · Dev: `uvicorn app.main:app` from `backend/` |
| **Frontend** | — | Static React build via `loadFile` — `frontend_dist/index.html` (prod) / `frontend/dist/index.html` (dev) |

Env injected into the backend: `DATABASE_URL = sqlite:///<userData>/vendorcompare.db`. Health check on
startup: `http://127.0.0.1:8000/api/health`. (No `OLLAMA_BASE_URL` / `VENDORCOMPARE_MODEL` — that's the
LOM AI Edition.)

### 2. MCP server (`~/vendorcompare-mcp/server.py`)

A `FastMCP("VendorCompare")` stdio server that exposes VendorCompare as **tools** to Claude Desktop. It is
a **thin HTTP proxy** — every tool calls the running backend at `BASE = http://127.0.0.1:8000/api`
(`list_categories`, `search_products`, `assemble_order`, … — QuickOrder phase ships 6 tools).

Registered in Claude Desktop at `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
"mcpServers": {
  "vendorcompare": {
    "command": "/opt/homebrew/bin/python3.11",
    "args": ["/Users/<user>/vendorcompare-mcp/server.py"]
  }
}
```

Claude Desktop spawns `server.py` as an MCP server; the `python3.11` it points at must have `mcp` + `httpx`
installed. (See `tool_shed/by_project/vendorcompare/FieldReport_MCP_Phase1_PathFix_2026-06-06.md` for the
interpreter/path fix history.)

---

## Critical dependency

**The MCP tools only work while the backend is running.** `server.py` proxies to `127.0.0.1:8000/api`, so
the **VendorCompare MCP app must be open** (it provides the backend on 8000) for Claude Desktop's
VendorCompare tools to return data. App closed → backend down → tools fail.

---

## Editions

| Edition | AI interface | Model | Local model? | Use |
|---------|--------------|-------|--------------|-----|
| **MCP Edition** (this doc) | Chat in **Claude Desktop** → MCP tools → local backend | Cloud Claude | No | Demo / users on Claude Desktop |
| **LOM AI Edition** | Chat with **Taquito inside the app** | `qwen2.5:7b` (bundled Ollama, 11435) | Yes | Fully independent local instance, no cloud |

> The repo's generic `README.md` (Docker / web / port 3000) describes neither edition's desktop runtime.
> Use this file for the MCP Edition and `README_LOM_AI_Edition.md` for the AI Edition.

---

## Related docs

- Setup walkthrough: `tool_shed/by_project/vendorcompare/MeetingGuide_John_MCP_Setup.md`
- Design / requirements: `tool_shed/by_project/vendorcompare/DesDoc_MCP_v1.md`, `PRD_MCP_Phase1_v1.md`
- Path fix field report: `tool_shed/by_project/vendorcompare/FieldReport_MCP_Phase1_PathFix_2026-06-06.md`

# Runtime — VendorCompare Backend

## Python
- **Required:** Python 3.11+
- **Tested on:** Python 3.11.x (Mac arm64), Python 3.11.x (Raspberry Pi aarch64)
- **Dev venv:** `backend/.venv_electron` (created by Electron build toolchain; reuse for dev)

## Dependencies
- Pinned in `backend/requirements.txt`
- Install: `pip install -r requirements.txt` (inside venv)

## Node / Electron (frontend + packaging)
- See `frontend/package.json` and `electron/package.json` for pinned versions
- Install: `npm install` in each directory

## Ollama (LOM AI Edition only)
- Model: `qwen2.5:7b`
- App-bundled Ollama runs on port 11435
- System Ollama (if installed separately) runs on 11434 — do not confuse them

## Key runtime notes
- `DATABASE_URL` must be set for manual uvicorn starts (see `.env.example`)
- `migrate_014a.py` uses a hardcoded fallback path `/opt/vendorcompare/...` when `DATABASE_URL` is unset — always set it

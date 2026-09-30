#!/bin/bash
# Start VendorCompare backend for dev/probe use.
# Sets DATABASE_URL so migrate_014a resolves correctly (Electron app sets this automatically).
# Usage: ./scripts/start_backend.sh [port]
# Default port: 8001 (leaves 8000 free for Electron app)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PORT="${1:-8001}"

# Kill any stale backend on target port before starting
STALE_PID=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
if [ -n "$STALE_PID" ]; then
  echo "[start_backend] Killing stale process on port $PORT (PID $STALE_PID)"
  kill "$STALE_PID"
  sleep 1
fi

cd "$BACKEND_DIR"
source .venv_electron/bin/activate

export DATABASE_URL="sqlite:///./vendorcompare.db"
export VENDORCOMPARE_ENV="development"

echo "[start_backend] Starting on port $PORT (DB: $DATABASE_URL)"
python3 -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT"

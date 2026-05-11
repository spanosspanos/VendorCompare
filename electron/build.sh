#!/usr/bin/env bash
# build.sh — Builds VendorCompare.dmg from scratch.
# Run from the project root: ./electron/build.sh
# Requires: node, npm, python3 (3.11+), pip
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
ELECTRON_DIR="$ROOT_DIR/electron"
VENV_DIR="$BACKEND_DIR/.venv_electron"
BACKEND_DIST="$ROOT_DIR/backend_dist"

echo "=== [1/4] Build React frontend (electron mode) ==="
cd "$FRONTEND_DIR"
npm install --silent
npm run build -- --mode electron
echo "    → $FRONTEND_DIR/dist"

echo "=== [2/4] Install Python deps (no playwright) ==="
python3.11 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip --quiet
"$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.electron.txt" --quiet
"$VENV_DIR/bin/pip" install pyinstaller --quiet
echo "    → venv at $VENV_DIR"

echo "=== [3/4] PyInstaller — bundle Python backend ==="
cd "$BACKEND_DIR"
"$VENV_DIR/bin/pyinstaller" \
  --onedir \
  --name vendorcompare_backend \
  --distpath "$BACKEND_DIST" \
  --workpath "$BACKEND_DIR/build_pyinstaller" \
  --specpath "$BACKEND_DIR" \
  --noconfirm \
  --hidden-import=passlib.handlers.bcrypt \
  --hidden-import=jose \
  --hidden-import=multipart \
  --hidden-import=uvicorn.logging \
  --hidden-import=uvicorn.loops.auto \
  --hidden-import=uvicorn.protocols.http.auto \
  --collect-all fastapi \
  --collect-all uvicorn \
  --collect-all sqlalchemy \
  --collect-all pydantic \
  electron_main.py
echo "    → $BACKEND_DIST/vendorcompare_backend/"

echo "=== [4/4] Build Electron DMG ==="
cd "$ELECTRON_DIR"
npm install --silent
npm run build
echo "    → $ELECTRON_DIR/dist/VendorCompare-*.dmg"

echo ""
echo "Build complete. DMG is in electron/dist/"

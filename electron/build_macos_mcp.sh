#!/bin/bash
# build_macos_mcp.sh — Build VendorCompare MCP Edition, remove old app, install.
set -euo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
ELECTRON_DIR="$ROOT_DIR/electron"
VENV_DIR="$BACKEND_DIR/.venv_electron"
BACKEND_DIST="$ROOT_DIR/backend_dist"

echo "=== VendorCompare MCP Edition macOS Build ==="
echo "Root: $ROOT_DIR"
echo ""

echo "=== Step 1 — Build frontend ==="
cd "$FRONTEND_DIR"
npm install --silent
VITE_EDITION=mcp npm run build -- --mode electron
echo "      Frontend built"

echo "=== Step 2 — Build Python backend (single file) ==="
python3.11 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip --quiet
"$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.electron.txt" --quiet
"$VENV_DIR/bin/pip" install pyinstaller --quiet

cd "$BACKEND_DIR"
"$VENV_DIR/bin/pyinstaller" \
  --onefile \
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
  --collect-all openai \
  --hidden-import=openai \
  electron_main.py
echo "      Backend bundled: $BACKEND_DIST/vendorcompare_backend"

echo "=== Step 3 — Package Electron DMG ==="
cd "$ELECTRON_DIR"
npm install --silent
npx electron-builder --mac dmg zip --arm64 --config build-mcp.json
echo "      DMG built"

echo "=== Step 4 — Remove old apps, install MCP ==="
DMG_PATH=$(find "$ELECTRON_DIR/dist" -name "*.dmg" ! -name "*.blockmap" | head -1)
if [ -z "$DMG_PATH" ]; then
  echo "ERROR: No DMG found in $ELECTRON_DIR/dist"
  exit 1
fi
echo "      DMG: $DMG_PATH"

echo "  Removing old VendorCompare installs..."
rm -rf /Applications/VendorCompare.app 2>/dev/null || true
rm -rf "/Applications/VendorCompare MCP.app" 2>/dev/null || true

echo "  Mounting DMG..."
# Detach any stale mounts
hdiutil detach "/Volumes/VendorCompare MCP" -quiet 2>/dev/null || true
MOUNT_OUTPUT=$(hdiutil attach "$DMG_PATH" -nobrowse -quiet)
# Dynamically find the mounted volume (handles "VendorCompare MCP 1.1.0" style names)
VOLUME=$(ls /Volumes/ | grep "VendorCompare MCP" | head -1)
echo "  Volume: /Volumes/$VOLUME"

echo "  Installing..."
cp -R "/Volumes/$VOLUME/VendorCompare MCP.app" /Applications/
xattr -cr "/Applications/VendorCompare MCP.app"
hdiutil detach "/Volumes/$VOLUME" -quiet 2>/dev/null || true

echo ""
echo "=== VendorCompare MCP Edition installed ==="
echo "App: /Applications/VendorCompare MCP.app"

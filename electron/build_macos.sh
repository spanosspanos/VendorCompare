#!/bin/bash
# build_macos.sh — Build VendorCompare AI Edition on macOS (Apple Silicon), stage qwen2.5:7b, package DMG, and upload.
set -euo pipefail

# Ensure Homebrew tools (npm, python3, etc.) are in PATH for non-interactive SSH sessions
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
ELECTRON_DIR="$ROOT_DIR/electron"
VENV_DIR="$BACKEND_DIR/.venv_electron"
BACKEND_DIST="$ROOT_DIR/backend_dist"

# Ollama.app installed on the build machine — this is the source of truth binary.
# It uses the self-contained runner architecture (runs itself as `ollama runner --ollama-engine`)
# rather than the separate llama-server runner required by Ollama 0.30+.
OLLAMA_APP_RESOURCES="/Applications/Ollama.app/Contents/Resources"

cleanup_ollama_build_server() {
  if [ -n "${OLLAMA_BUILD_PID:-}" ]; then
    kill "$OLLAMA_BUILD_PID" 2>/dev/null || true
    wait "$OLLAMA_BUILD_PID" 2>/dev/null || true
  fi
}
trap cleanup_ollama_build_server EXIT

echo "=== VendorCompare AI Edition macOS Build ==="
echo "Root: $ROOT_DIR"
echo ""

echo "=== Step 0 — Stage Ollama binary from Ollama.app ==="
# We use the Ollama.app binary because it is self-contained: the runner is embedded
# in the binary itself (invoked as `ollama runner --ollama-engine`). Ollama 0.30+
# releases require a separate llama-server binary that is not distributed in their
# tarballs for macOS, making them unusable for bundling.
if [ ! -f "$OLLAMA_APP_RESOURCES/ollama" ]; then
  echo "ERROR: Ollama.app not found at $OLLAMA_APP_RESOURCES"
  echo "       Install Ollama from https://ollama.com/download and launch it at least once."
  exit 1
fi

OLLAMA_BIN_DIR="$ELECTRON_DIR/resources/bin"
mkdir -p "$OLLAMA_BIN_DIR"

echo "      Clearing old Ollama artifacts from $OLLAMA_BIN_DIR..."
# Remove old binary and dylibs; preserve unrelated files
rm -f "$OLLAMA_BIN_DIR/ollama"
rm -f "$OLLAMA_BIN_DIR"/lib*.dylib "$OLLAMA_BIN_DIR"/lib*.so
rm -rf "$OLLAMA_BIN_DIR/mlx_metal_v3" "$OLLAMA_BIN_DIR/mlx_metal_v4"

echo "      Copying Ollama.app binary and runtime libraries..."
cp "$OLLAMA_APP_RESOURCES/ollama" "$OLLAMA_BIN_DIR/ollama"
chmod +x "$OLLAMA_BIN_DIR/ollama"

# Copy companion dylibs and CPU variant .so files (needed by the embedded runner)
for f in "$OLLAMA_APP_RESOURCES"/lib*.dylib "$OLLAMA_APP_RESOURCES"/lib*.so; do
  [ -f "$f" ] || continue
  cp "$f" "$OLLAMA_BIN_DIR/"
done

# Copy MLX Metal acceleration directories (Apple Silicon GPU support)
for d in mlx_metal_v3 mlx_metal_v4; do
  [ -d "$OLLAMA_APP_RESOURCES/$d" ] || continue
  cp -R "$OLLAMA_APP_RESOURCES/$d" "$OLLAMA_BIN_DIR/"
done

OLLAMA_VERSION=$("$OLLAMA_BIN_DIR/ollama" --version 2>&1 | head -1)
echo "      Ollama staged: $OLLAMA_VERSION"
echo ""

echo "=== Step 1 — Build the app from source ==="
echo "[1.1] Build React frontend (electron mode)..."
cd "$FRONTEND_DIR"
npm install --silent
npm run build -- --mode electron
echo "      Frontend built: $FRONTEND_DIR/dist"

echo "[1.2] Install Python deps (no playwright)..."
python3.11 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.electron.txt"
"$VENV_DIR/bin/pip" install pyinstaller
echo "      venv ready: $VENV_DIR"

echo "[1.3] PyInstaller — bundle Python backend..."
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
echo "      Backend bundled: $BACKEND_DIST/vendorcompare_backend/"

echo "[1.4] Build Electron .app..."
cd "$ELECTRON_DIR"
npm install --silent
npx electron-builder --mac dir --arm64
echo "      App built: $ELECTRON_DIR/dist/mac-arm64/VendorCompare.app"
echo ""

echo "=== Step 2 — Convert icon ==="
ICON_SRC="$ELECTRON_DIR/resources/icon_source.jpg"
ICONSET_DIR="$ELECTRON_DIR/resources/icon.iconset"
mkdir -p "$ICONSET_DIR"
for SIZE in 16 32 64 128 256 512 1024; do
  sips -z $SIZE $SIZE "$ICON_SRC" -s format png --out "$ICONSET_DIR/icon_${SIZE}x${SIZE}.png"
done
cp "$ICONSET_DIR/icon_32x32.png"   "$ICONSET_DIR/icon_16x16@2x.png"
cp "$ICONSET_DIR/icon_64x64.png"   "$ICONSET_DIR/icon_32x32@2x.png"
cp "$ICONSET_DIR/icon_256x256.png" "$ICONSET_DIR/icon_128x128@2x.png"
cp "$ICONSET_DIR/icon_512x512.png" "$ICONSET_DIR/icon_256x256@2x.png"
cp "$ICONSET_DIR/icon_1024x1024.png" "$ICONSET_DIR/icon_512x512@2x.png"
iconutil -c icns "$ICONSET_DIR" -o "$ELECTRON_DIR/resources/icon.icns"
rm -rf "$ICONSET_DIR"
echo "      Icon created: $ELECTRON_DIR/resources/icon.icns"
echo ""

echo "=== Step 3 — Stage qwen2.5:7b model ==="
MODELS_TEMP="/tmp/vc-ai-models-$$"
MODELS_DEST="$ELECTRON_DIR/models"
mkdir -p "$MODELS_TEMP"
rm -rf "$MODELS_DEST"

OLLAMA_BIN="$ELECTRON_DIR/resources/bin/ollama"
OLLAMA_LIB_DIR="$ELECTRON_DIR/resources/bin"
chmod +x "$OLLAMA_BIN"
DYLD_LIBRARY_PATH="$OLLAMA_LIB_DIR${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}" \
  OLLAMA_MODELS="$MODELS_TEMP" OLLAMA_HOST="127.0.0.1:11436" "$OLLAMA_BIN" serve &
OLLAMA_BUILD_PID=$!
echo "Waiting for Ollama build server..."
for i in $(seq 1 30); do
  curl -sf http://127.0.0.1:11436/api/tags >/dev/null 2>&1 && break
  sleep 1
done

DYLD_LIBRARY_PATH="$OLLAMA_LIB_DIR${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}" \
  OLLAMA_HOST="127.0.0.1:11436" "$OLLAMA_BIN" pull qwen2.5:7b

kill $OLLAMA_BUILD_PID 2>/dev/null || true
wait $OLLAMA_BUILD_PID 2>/dev/null || true
unset OLLAMA_BUILD_PID

cp -r "$MODELS_TEMP" "$MODELS_DEST"
rm -rf "$MODELS_TEMP"
echo "Model staged: $MODELS_DEST"
echo ""

echo "=== Step 4 — Build DMG with staged model ==="
cd "$ELECTRON_DIR"
npx electron-builder --mac dmg --arm64
echo "      DMG build complete: $ELECTRON_DIR/dist"
echo ""

echo "=== Step 5 — Upload to AI Edition endpoint ==="
# PUBLISH guard (Dev SOP: separate build from deploy). Default PUBLISH=1 preserves
# original behavior. Set PUBLISH=0 to build only and skip the production upload —
# lets the launch + one-real-query staging gate (R4) run before anything ships.
if [ "${PUBLISH:-1}" != "1" ]; then
  echo "      PUBLISH=${PUBLISH:-1} — build-only; skipping production upload."
  echo "      DMG left in: $ELECTRON_DIR/dist"
  echo ""
  echo "=== VendorCompare AI Edition build complete (build-only, NOT published) ==="
  exit 0
fi
DMG_PATH=$(find "$ELECTRON_DIR/dist" \( -name "VendorCompare-AI*.dmg" -o -name "VendorCompare-*.dmg" \) -type f | grep -v blockmap | head -1)
if [ -z "$DMG_PATH" ]; then
  echo "ERROR: No VendorCompare DMG found in $ELECTRON_DIR/dist"
  exit 1
fi
scp -i ~/.ssh/hetzner "$DMG_PATH" root@100.114.199.92:/var/www/aitoolchest/vendorcompare/download/ai/VendorCompare-AI.dmg
YML_PATH=$(find "$ELECTRON_DIR/dist" -name "latest-mac.yml" -type f | head -1)
if [ -z "$YML_PATH" ]; then
  echo "ERROR: latest-mac.yml not found in $ELECTRON_DIR/dist"
  exit 1
fi
scp -i ~/.ssh/hetzner "$YML_PATH" root@100.114.199.92:/var/www/aitoolchest/vendorcompare/download/ai/latest-mac.yml

echo ""
echo "=== VendorCompare AI Edition build complete ==="
echo "Download URL: https://aitoolchest.space/vendorcompare/download/ai/VendorCompare-AI.dmg"

#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_SRC="$SCRIPT_DIR/VendorCompare.app"
APP_DEST="/Applications/VendorCompare.app"
MODELS_SRC="$SCRIPT_DIR/models"
MODELS_DEST="$HOME/Library/Application Support/VendorCompare/ollama/models"

echo "=== Installing VendorCompare AI Edition ==="

echo "[1/4] Copying app to /Applications..."
rm -rf "$APP_DEST"
cp -r "$APP_SRC" "$APP_DEST"

echo "[2/4] Removing quarantine..."
xattr -cr "$APP_DEST"

echo "[3/4] Staging AI model..."
if [ -d "$MODELS_DEST" ] && [ "$(ls -A "$MODELS_DEST" 2>/dev/null)" ]; then
  echo "      Model already present — skipping."
else
  mkdir -p "$MODELS_DEST"
  cp -r "$MODELS_SRC/." "$MODELS_DEST/"
  echo "      Model staged."
fi

echo "[4/4] Launching VendorCompare..."
open "$APP_DEST"

echo ""
echo "Done. VendorCompare AI Edition is installed."

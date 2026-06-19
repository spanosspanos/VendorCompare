#!/bin/bash
# VendorCompare Installer — removes macOS quarantine and copies to Applications

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_SOURCE="$SCRIPT_DIR/VendorCompare.app"
APP_DEST="/Applications/VendorCompare.app"

echo ""
echo "Installing VendorCompare..."

if [ ! -d "$APP_SOURCE" ]; then
  echo "Error: VendorCompare.app not found next to this installer."
  echo "Please make sure the DMG is still open and try again."
  read -p "Press Enter to close."
  exit 1
fi

if [ -d "$APP_DEST" ]; then
  rm -rf "$APP_DEST"
fi

cp -R "$APP_SOURCE" "$APP_DEST"
xattr -cr "$APP_DEST"

echo "Done! Launching VendorCompare..."
sleep 1
open "$APP_DEST"

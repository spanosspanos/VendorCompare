#!/bin/bash
set -e
SSH="ssh -i ~/.ssh/id_ed25519"
MAC="smileydaffy@100.109.138.25"
SERVER="root@100.114.199.92"
SERVER_KEY="~/.ssh/hetzner"
DEPLOY_DIR="/var/www/aitoolchest/vendorcompare/download"

echo "=== VendorCompare Deploy Pipeline ==="

echo "[1/5] Building frontend..."
$SSH $MAC "cd ~/Projects/VendorCompare_Build/Phase_1_Scaffolding/frontend && env PATH=/opt/homebrew/bin:/usr/local/bin:\$PATH /opt/homebrew/bin/npm run build:electron"

echo "[2/5] Verifying null guard in bundle..."
$SSH $MAC "grep -q 'new_price!=null' ~/Projects/VendorCompare_Build/Phase_1_Scaffolding/frontend/dist/assets/*.js && echo 'PASS: null guard confirmed' || (echo 'FAIL: null guard missing from bundle'; exit 1)"

echo "[3/5] Building DMG..."
$SSH $MAC "cd ~/Projects/VendorCompare_Build/Phase_1_Scaffolding/electron && rm -rf dist/ && env PATH=/opt/homebrew/bin:/usr/local/bin:\$PATH /opt/homebrew/bin/npm run build"

echo "[4/5] Deploying to aitoolchest.space..."
VERSION=$($SSH $MAC "cat ~/Projects/VendorCompare_Build/Phase_1_Scaffolding/electron/package.json | python3 -c \"import sys,json; print(json.load(sys.stdin)['version'])\"")
echo "    Version: $VERSION"
$SSH $MAC "scp -i ${SERVER_KEY} \
  ~/Projects/VendorCompare_Build/Phase_1_Scaffolding/electron/dist/VendorCompare-${VERSION}-arm64.dmg \
  ~/Projects/VendorCompare_Build/Phase_1_Scaffolding/electron/dist/VendorCompare-${VERSION}-arm64-mac.zip \
  ~/Projects/VendorCompare_Build/Phase_1_Scaffolding/electron/dist/latest-mac.yml \
  ${SERVER}:${DEPLOY_DIR}/"
$SSH $MAC "ssh -i ${SERVER_KEY} ${SERVER} \
  'sed -i \"s/VendorCompare-[0-9]*\\.[0-9]*\\.[0-9]*-arm64/VendorCompare-${VERSION}-arm64/g; s/VendorCompare [0-9]*\\.[0-9]*\\.[0-9]*/VendorCompare ${VERSION}/g\" ${DEPLOY_DIR}/index.html'"

echo "[5/5] Smoke testing backend..."
$SSH $MAC "curl -sf http://localhost:8000/api/health | grep -q 'ok' && echo 'PASS: backend healthy' || echo 'WARN: backend not running'"

echo ""
echo "=== Deploy complete: VendorCompare ${VERSION} ==="

#!/bin/bash
# Pre-deploy gate: run this before any production deploy.
# Exits non-zero if any check fails.

set -e

echo "[deploy_check] Running pre-deploy gates..."

# 1. SECRET_KEY must not be the default
if python3 -c "
import os, sys
key = os.getenv('SECRET_KEY', 'dev-secret-change-in-prod')
if key == 'dev-secret-change-in-prod':
    print('ERROR: SECRET_KEY is the default dev value. Set a real SECRET_KEY before deploying.')
    sys.exit(1)
print('SECRET_KEY: set (non-default)')
"; then
  echo "[deploy_check] ✅ SECRET_KEY"
else
  exit 1
fi

# 2. Warn if deploying uncommitted changes
if ! git diff --quiet HEAD; then
  echo "[deploy_check] ⚠️  WARNING: Uncommitted changes present. Tag a clean commit before shipping."
fi

echo "[deploy_check] All gates passed. Safe to deploy."

#!/usr/bin/env bash
# Faz 6C-Beta D3 — app rebuild from faz-6c-beta-d3 (no migration, no volume prune)
set -Eeuo pipefail

ROOT="${ACAR_ROOT:-/opt/acarindex}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

BASE_LOCAL="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"
BRANCH="${ACAR_D3_BRANCH:-faz-6c-beta-d3}"
LOG="/var/log/acarindex-faz6c-beta-d3-deploy.log"

acar_beta_require_pilot

exec > >(tee -a "$LOG") 2>&1

echo "=== FAZ6C BETA D3 DEPLOY $(date -Is) ==="
cd "$ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "FAIL: working tree not clean"
  git status --short
  exit 1
fi

git fetch origin
LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse "origin/${BRANCH}")
echo "LOCAL_SHA=$LOCAL_SHA"
echo "REMOTE_SHA=$REMOTE_SHA"
[[ "$LOCAL_SHA" == "$REMOTE_SHA" ]] || { echo "FAIL: HEAD != origin/${BRANCH}"; exit 1; }

CURRENT_BRANCH=$(git branch --show-current)
[[ "$CURRENT_BRANCH" == "$BRANCH" ]] || { echo "FAIL: on $CURRENT_BRANCH expected $BRANCH"; exit 1; }

echo "=== HEALTH PRE ==="
curl -sf "$BASE_LOCAL/api/health" && echo health_ok

echo "=== BUILD APP ==="
$ACAR_COMPOSE build app
$ACAR_COMPOSE --profile app up -d --no-deps app
sleep 30

echo "=== HEALTH POST ==="
curl -sf "$BASE_LOCAL/api/health" && echo health_ok
$ACAR_COMPOSE ps

echo "DEPLOY_SHA=$LOCAL_SHA"
echo "FAZ6C_BETA_D3_DEPLOY_OK"

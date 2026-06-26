#!/usr/bin/env bash
# Faz 6C-Beta C — responsive auth lifecycle Playwright (pilot localhost, flag değiştirmez)
set -Eeuo pipefail

ROOT="${ACAR_ROOT:-/opt/acarindex}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

SHOT_DIR="/var/log/acarindex-responsive-shots"
TOKEN_DIR="/var/log/acarindex-responsive-private"
ENV_FILE="$TOKEN_DIR/tokens.env"
PLAYWRIGHT_IMAGE="${ACAR_PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.49.1-noble}"

acar_beta_require_pilot
cd "$ROOT"
install -d -m 700 "$SHOT_DIR" "$TOKEN_DIR"
rm -f "$ENV_FILE"

echo "=== FIXTURES ==="
docker compose --env-file /etc/acarindex/pilot.env -f docker-compose.pilot.yml --profile tools run --rm --no-deps \
  -e ACAR_RESPONSIVE_ENV_FILE=/tokens/tokens.env \
  -v "$TOKEN_DIR:/tokens" \
  etl scripts/test/beta-responsive-fixtures.ts

[[ -f "$ENV_FILE" ]] || { echo "FAIL: fixture env"; exit 1; }

PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
CRED="${ACAR_ADMIN_CRED:-/root/.faz6a-admin-credentials}"
HESABIM_EMAIL=""
HESABIM_PASS=""
if [[ -f "$CRED" ]]; then
  HESABIM_EMAIL=$(grep '^email=' "$CRED" | cut -d= -f2- | tr -d '\r')
  HESABIM_PASS=$(grep '^pass=' "$CRED" | cut -d= -f2- | tr -d '\r')
fi

echo "=== PLAYWRIGHT ==="
docker run --rm \
  -v "$ROOT:/app" \
  -v "$SHOT_DIR:$SHOT_DIR" \
  -w /app \
  --env-file "$ENV_FILE" \
  -e BASE_URL=http://127.0.0.1:3002 \
  -e ACAR_RESPONSIVE_SHOTS="$SHOT_DIR" \
  -e ACAR_HESABIM_TEST_EMAIL="$HESABIM_EMAIL" \
  -e ACAR_HESABIM_TEST_PASSWORD="$HESABIM_PASS" \
  --network host \
  "$PLAYWRIGHT_IMAGE" \
  bash -c 'npm install @playwright/test@1.49.1 --no-save && npx playwright test --config=playwright.beta-responsive.config.ts'

echo "=== CLEANUP ==="
docker compose --env-file /etc/acarindex/pilot.env -f docker-compose.pilot.yml --profile tools run --rm --no-deps \
  etl scripts/test/beta-responsive-cleanup.ts
rm -f "$ENV_FILE"
rmdir "$TOKEN_DIR" 2>/dev/null || true

users=$(docker compose --env-file /etc/acarindex/pilot.env -f docker-compose.pilot.yml exec -T postgres \
  psql -U acarindex_pilot -d acarindex_pilot -tAc "SELECT count(*) FROM users;" | tr -d '[:space:]')
articles=$(docker compose --env-file /etc/acarindex/pilot.env -f docker-compose.pilot.yml exec -T postgres \
  psql -U acarindex_pilot -d acarindex_pilot -tAc "SELECT count(*) FROM articles;" | tr -d '[:space:]')
echo "users=$users articles=$articles"
[[ "$users" == "1" && "$articles" == "8000" ]] || { echo "FAIL: counts"; exit 1; }

echo "SHOT_DIR=$SHOT_DIR"
echo "RESPONSIVE_PLAYWRIGHT_OK"

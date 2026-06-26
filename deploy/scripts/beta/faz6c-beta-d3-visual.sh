#!/usr/bin/env bash
# Faz 6C-Beta D3 — site-wide visual acceptance Playwright (pilot localhost)
set -Eeuo pipefail

ROOT="${ACAR_ROOT:-/opt/acarindex}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

SHOT_DIR="/var/log/acarindex-d3-visual-review"
PLAYWRIGHT_IMAGE="${ACAR_PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.49.1-noble}"

acar_beta_require_pilot
cd "$ROOT"
install -d -m 755 "$SHOT_DIR"
install -d -m 755 "$SHOT_DIR/before" "$SHOT_DIR/after" "$SHOT_DIR/desktop" "$SHOT_DIR/tablet" "$SHOT_DIR/mobile" "$SHOT_DIR/states"

PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
CRED="${ACAR_ADMIN_CRED:-/root/.faz6a-admin-credentials}"
HESABIM_EMAIL=""
HESABIM_PASS=""
if [[ -f "$CRED" ]]; then
  HESABIM_EMAIL=$(grep '^email=' "$CRED" | cut -d= -f2- | tr -d '\r')
  HESABIM_PASS=$(grep '^pass=' "$CRED" | cut -d= -f2- | tr -d '\r')
fi
[[ -n "$HESABIM_EMAIL" && -n "$HESABIM_PASS" ]] || { echo "FAIL: admin creds missing"; exit 1; }

HESABIM_ENV="/tmp/faz6c-d3-hesabim.env"
printf 'ACAR_HESABIM_TEST_EMAIL=%s\nACAR_HESABIM_TEST_PASSWORD=%s\n' "$HESABIM_EMAIL" "$HESABIM_PASS" > "$HESABIM_ENV"
chmod 600 "$HESABIM_ENV"

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c "DELETE FROM login_attempts;" >/dev/null

echo "=== PLAYWRIGHT D3 VISUAL ==="
docker run --rm \
  -v "$ROOT:/app" \
  -v "$SHOT_DIR:$SHOT_DIR" \
  -w /app \
  --env-file "$HESABIM_ENV" \
  -e BASE_URL=http://127.0.0.1:3002 \
  -e ACAR_D3_VISUAL_REVIEW="$SHOT_DIR" \
  --network host \
  "$PLAYWRIGHT_IMAGE" \
  bash -c 'npm install @playwright/test@1.49.1 --no-save && npx playwright test --config=playwright.beta-d3.config.ts'

rm -f "$HESABIM_ENV"

echo "SHOT_DIR=$SHOT_DIR"
echo "D3_VISUAL_PLAYWRIGHT_OK"

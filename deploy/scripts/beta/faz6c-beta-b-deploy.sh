#!/usr/bin/env bash
# Faz 6C-Beta B — backup + app build (flag'ler kapalı kalır)
set -Eeuo pipefail

ROOT="${ACAR_ROOT:-/opt/acarindex}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

BASE_LOCAL="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"
PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
LOG="/var/log/acarindex-faz6c-beta-b-deploy.log"

acar_beta_require_pilot

exec > >(tee -a "$LOG") 2>&1

echo "=== FAZ6C BETA B DEPLOY $(date -Is) ==="
cd "$ROOT"

require_env() {
  local key="$1"
  grep -q "^${key}=" "$PILOT_ENV" || { echo "FAIL: missing $key in pilot.env" >&2; exit 1; }
  local val
  val=$(grep "^${key}=" "$PILOT_ENV" | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
  [[ -n "$val" ]] || { echo "FAIL: empty $key" >&2; exit 1; }
}

echo "=== PRE CHECKS ==="
curl -sf "$BASE_LOCAL/api/health" && echo health_ok
ext=$(curl -s -o /dev/null -w '%{http_code}' https://beta.acarindex.com/ 2>/dev/null || echo 000)
[[ "$ext" == "401" ]] || { echo "FAIL: basic auth $ext"; exit 1; }
robots=$(curl -sI https://beta.acarindex.com/ 2>/dev/null | tr -d '\r' | grep -i x-robots-tag || true)
echo "robots:${robots}"
echo "$robots" | grep -qi noindex || { echo "FAIL: noindex"; exit 1; }
df -h / | tail -1

$ACAR_COMPOSE --profile tools run --rm migrate 2>&1 | tail -3

grep -q '^EMAIL_PROVIDER=resend' "$PILOT_ENV" || { echo "FAIL: EMAIL_PROVIDER must be resend"; exit 1; }
grep -q '^ACAR_RESEND_DOMAIN_VERIFIED=1' "$PILOT_ENV" || { echo "FAIL: ACAR_RESEND_DOMAIN_VERIFIED"; exit 1; }
require_env RESEND_API_KEY
require_env EMAIL_FROM
require_env APP_PUBLIC_URL
require_env ACAR_BETA_MAIL_TEST_EMAIL
app_url=$(grep '^APP_PUBLIC_URL=' "$PILOT_ENV" | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
[[ "$app_url" == "https://beta.acarindex.com" ]] || { echo "FAIL: APP_PUBLIC_URL must be https://beta.acarindex.com"; exit 1; }
email_from=$(grep '^EMAIL_FROM=' "$PILOT_ENV" | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
echo "$email_from" | grep -q 'notify\.acarindex\.com' || { echo "FAIL: EMAIL_FROM domain"; exit 1; }

for flag in ENABLE_PUBLIC_REGISTRATION ENABLE_EMAIL_VERIFICATION ENABLE_PASSWORD_RESET ENABLE_CAPTCHA; do
  val=$(grep "^${flag}=" "$PILOT_ENV" | cut -d= -f2- | tr -d '\r' || echo "")
  echo "${flag}=${val}"
  [[ "$val" == "0" ]] || { echo "FAIL: ${flag} must be 0 at start"; exit 1; }
done

echo "=== PRE BACKUP ==="
bash "$ROOT/deploy/scripts/faz6a1-beta-backup.sh" pre_resend_provider
PRE_BACKUP=$(ls -t /var/backups/acarindex-pilot/pilot_pg_pre_resend_*.dump | head -1)
echo "PRE_BACKUP=$PRE_BACKUP"
bash "$SCRIPT_DIR/faz6b-beta-restore-test.sh" "$PRE_BACKUP"

echo "=== BUILD APP ==="
$ACAR_COMPOSE build app
$ACAR_COMPOSE --profile app up -d --no-deps app
sleep 30
curl -sf "$BASE_LOCAL/api/health" && echo

echo "FAZ6C_BETA_B_DEPLOY_OK flags_still_off"

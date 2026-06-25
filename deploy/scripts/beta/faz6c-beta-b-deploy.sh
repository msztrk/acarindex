#!/usr/bin/env bash
# Faz 6C-Beta B — Resend provider deploy (flags aşamalı açılır; public registration kapalı)
set -Eeuo pipefail

ROOT="${ACAR_ROOT:-/opt/acarindex}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

BASE_LOCAL="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"
PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
LOG="/var/log/acarindex-faz6c-beta-b-deploy.log"
TEST_EMAIL="${ACAR_BETA_MAIL_TEST_EMAIL:-}"

acar_beta_require_pilot

exec > >(tee -a "$LOG") 2>&1

echo "=== FAZ6C BETA B DEPLOY $(date -Is) ==="
cd "$ROOT"

require_env() {
  local key="$1"
  grep -q "^${key}=" "$PILOT_ENV" || { echo "FAIL: missing $key in pilot.env" >&2; exit 1; }
  local val
  val=$(grep "^${key}=" "$PILOT_ENV" | cut -d= -f2- | tr -d '\r')
  [[ -n "$val" ]] || { echo "FAIL: empty $key" >&2; exit 1; }
}

echo "=== PRE CHECKS ==="
curl -sf "$BASE_LOCAL/api/health" && echo health_ok
ext=$(curl -s -o /dev/null -w '%{http_code}' https://beta.acarindex.com/ 2>/dev/null || echo 000)
[[ "$ext" == "401" ]] || { echo "FAIL: basic auth $ext"; exit 1; }
df -h / | tail -1

$ACAR_COMPOSE --profile tools run --rm migrate 2>&1 | tail -3

echo "=== PRE BACKUP ==="
bash "$ROOT/deploy/scripts/faz6a1-beta-backup.sh" pre_resend_provider

require_env EMAIL_PROVIDER
require_env RESEND_API_KEY
require_env EMAIL_FROM
require_env APP_PUBLIC_URL

grep -q '^EMAIL_PROVIDER=resend' "$PILOT_ENV" || { echo "FAIL: EMAIL_PROVIDER must be resend"; exit 1; }
grep -q '^ENABLE_PUBLIC_REGISTRATION=0' "$PILOT_ENV" || echo "WARN: set ENABLE_PUBLIC_REGISTRATION=0"
grep -q '^ENABLE_EMAIL_VERIFICATION=0' "$PILOT_ENV" || true
grep -q '^ENABLE_PASSWORD_RESET=0' "$PILOT_ENV" || true

if [[ "${ACAR_RESEND_DOMAIN_VERIFIED:-}" != "1" ]]; then
  echo "FAIL: ACAR_RESEND_DOMAIN_VERIFIED=1 gerekli (notify.acarindex.com DNS doğrulaması)"
  exit 1
fi

echo "=== BUILD APP ==="
$ACAR_COMPOSE build app
$ACAR_COMPOSE --profile app up -d --no-deps app
sleep 30
curl -sf "$BASE_LOCAL/api/health" && echo

echo "=== FLAGS: verification only ==="
for kv in ENABLE_EMAIL_VERIFICATION=1 ENABLE_PASSWORD_RESET=0 ENABLE_PUBLIC_REGISTRATION=0; do
  key="${kv%%=*}"; val="${kv#*=}"
  if grep -q "^${key}=" "$PILOT_ENV"; then sed -i "s/^${key}=.*/${key}=${val}/" "$PILOT_ENV"; else echo "${key}=${val}" >> "$PILOT_ENV"; fi
done
$ACAR_COMPOSE --profile app up -d --no-deps app
sleep 15

if [[ -z "$TEST_EMAIL" ]]; then
  echo "STOP: ACAR_BETA_MAIL_TEST_EMAIL tanımlı değil — mail kabul testleri için gerekli"
  exit 2
fi

echo "FAZ6C_BETA_B_DEPLOY_OK verification_flag_on"

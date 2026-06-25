#!/usr/bin/env bash
# Tek zararsız Resend provider test e-postası (feature flag kapalı)
set -Eeuo pipefail

ROOT="${ACAR_ROOT:-/opt/acarindex}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
TEST_EMAIL=$(grep '^ACAR_BETA_MAIL_TEST_EMAIL=' "$PILOT_ENV" | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
[[ -n "$TEST_EMAIL" ]] || { echo "FAIL: ACAR_BETA_MAIL_TEST_EMAIL" >&2; exit 1; }

grep -q '^RESEND_API_KEY=.' "$PILOT_ENV" || {
  echo "FAIL: RESEND_API_KEY=MISSING — provider ping çalıştırılmadı" >&2
  exit 1
}

acar_beta_require_pilot
cd "$ROOT"

echo "=== RESEND PROVIDER PING to configured test address ==="
PING_OUT=$($ACAR_COMPOSE --profile tools run --rm \
  -e ACAR_BETA_MAIL_TEST_EMAIL="$TEST_EMAIL" \
  etl scripts/test/resend-provider-ping.ts 2>&1) || {
  echo "$PING_OUT" | sed 's/re_[A-Za-z0-9_-]*/[REDACTED]/g'
  echo "FAIL: provider ping command failed"
  exit 1
}

echo "$PING_OUT" | sed 's/re_[A-Za-z0-9_-]*/[REDACTED]/g'
echo "$PING_OUT" | grep -q 'provider_ping_accepted' || {
  echo "FAIL: Resend API accepted yanıtı alınamadı"
  exit 1
}

echo "=== APP LOG CHECK (no secrets) ==="
docker logs acarindex_pilot_app --tail 30 2>&1 | grep -iE 're_|api_key|token=|verify-email' && {
  echo "FAIL: sensitive log pattern"
  exit 1
} || echo "no_sensitive_patterns"

echo "RESEND_PROVIDER_PING_API_OK"
echo "WAIT: kullanıcı gelen kutusu/spam doğrulaması sonrası faz6c-beta-b-enable-verification.sh çalıştırın"

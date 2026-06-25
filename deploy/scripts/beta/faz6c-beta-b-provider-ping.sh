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

acar_beta_require_pilot
cd "$ROOT"

echo "=== RESEND PROVIDER PING to configured test address ==="
docker compose --env-file "$PILOT_ENV" -f /opt/acarindex/docker-compose.pilot.yml --profile tools run --rm \
  -e ACAR_BETA_MAIL_TEST_EMAIL="$TEST_EMAIL" \
  etl scripts/test/resend-provider-ping.ts

echo "=== APP LOG CHECK (no secrets) ==="
docker logs acarindex_pilot_app --tail 30 2>&1 | grep -iE 're_|api_key|token=|verify-email' && {
  echo "FAIL: sensitive log pattern"
  exit 1
} || echo "no_sensitive_patterns"

echo "RESEND_PROVIDER_PING_OK"
echo "WAIT: kullanıcı gelen kutusu/spam doğrulaması sonrası faz6c-beta-b-enable-verification.sh çalıştırın"

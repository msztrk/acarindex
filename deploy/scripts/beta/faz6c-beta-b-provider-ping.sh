#!/usr/bin/env bash
# Tek zararsız Resend provider test e-postası (feature flag kapalı)
# DB bağımlılığı yok — --no-deps ile PG/MySQL restart/recreate edilmez.
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

redact_output() {
  sed -E \
    -e 's/re_[A-Za-z0-9_-]+/[REDACTED]/g' \
    -e 's/(Bearer[[:space:]]+)[A-Za-z0-9._-]+/\1[REDACTED]/gi' \
    -e 's/(postgresql:\/\/[^:]+:)[^@]+@/\1[REDACTED]@/g' \
    -e 's/((RESEND_API_KEY|password|secret|token)=[^[:space:]]{8,})/\1[REDACTED]/gi'
}

# Yalnızca gerçek secret sızıntıları — prisma:error / FATAL / bağlantı kesilmesi sayılmaz.
check_sensitive_app_logs() {
  local logs pattern
  logs=$(docker logs acarindex_pilot_app --tail 50 2>&1)

  if echo "$logs" | grep -qE 're_[A-Za-z0-9_-]{10,}'; then
    pattern='resend_api_key'
  elif echo "$logs" | grep -qiE 'Authorization:[[:space:]]*Bearer[[:space:]]+[A-Za-z0-9._-]{8,}'; then
    pattern='bearer_token'
  elif echo "$logs" | grep -qE 'postgresql://[^[:space:]]+:[^@]+@'; then
    pattern='database_url_password'
  elif echo "$logs" | grep -qiE '(RESEND_API_KEY|password|secret)=[^[:space:]]{8,}'; then
    pattern='env_secret_assignment'
  elif echo "$logs" | grep -qE 'token=[A-Za-z0-9_-]{20,}'; then
    pattern='raw_token_query'
  else
    pattern=''
  fi

  if [[ -n "$pattern" ]]; then
    echo "sensitive_pattern=$pattern"
    return 1
  fi
  return 0
}

PROVIDER_OK=0
POST_CHECK_OK=0

echo "=== RESEND PROVIDER PING (no-deps, no DB) ==="
PING_OUT=$($ACAR_COMPOSE --profile tools run --rm --no-deps \
  -e ACAR_BETA_MAIL_TEST_EMAIL="$TEST_EMAIL" \
  etl scripts/test/resend-provider-ping.ts 2>&1) || {
  redact_output <<<"$PING_OUT"
  echo "FAIL: provider ping command failed"
  exit 1
}

redact_output <<<"$PING_OUT"

if echo "$PING_OUT" | grep -q 'provider_ping_accepted'; then
  PROVIDER_OK=1
  echo "PROVIDER_PING_ACCEPTED=ok"
else
  echo "FAIL: Resend API accepted yanıtı alınamadı"
  exit 1
fi

echo "=== APP LOG CHECK (secret patterns only) ==="
if check_sensitive_app_logs; then
  POST_CHECK_OK=1
  echo "no_sensitive_patterns"
else
  echo "provider accepted, post-check failed"
  exit 1
fi

echo "RESEND_PROVIDER_PING_API_OK"
echo "WAIT: kullanıcı gelen kutusu/spam doğrulaması sonrası faz6c-beta-b-enable-verification.sh çalıştırın"

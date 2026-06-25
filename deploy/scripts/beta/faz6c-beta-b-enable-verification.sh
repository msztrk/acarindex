#!/usr/bin/env bash
# E-posta doğrulama flag'ini aç (yalnızca provider ping teslimatı onaylandıktan sonra)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
BASE_LOCAL="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"

acar_beta_require_pilot

if [[ "${ACAR_PROVIDER_PING_CONFIRMED:-}" != "1" ]]; then
  echo "FAIL: ACAR_PROVIDER_PING_CONFIRMED=1 gerekli (kullanıcı teslimat onayı)" >&2
  exit 1
fi

set_kv() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$PILOT_ENV"; then sed -i "s/^${key}=.*/${key}=${val}/" "$PILOT_ENV"; else echo "${key}=${val}" >> "$PILOT_ENV"; fi
}

set_kv ENABLE_EMAIL_VERIFICATION 1
set_kv ENABLE_PASSWORD_RESET 0
set_kv ENABLE_PUBLIC_REGISTRATION 0
set_kv ENABLE_CAPTCHA 0

$ACAR_COMPOSE --profile app up -d --no-deps app
sleep 20
curl -sf "$BASE_LOCAL/api/health" && echo
flags=$(curl -s "$BASE_LOCAL/api/features")
echo "$flags"
echo "$flags" | grep -q '"emailVerification":true' || { echo "FAIL: verification flag"; exit 1; }
echo "$flags" | grep -q '"passwordReset":false' || { echo "FAIL: reset should be false"; exit 1; }
echo "$flags" | grep -q '"publicRegistration":false' || { echo "FAIL: registration false"; exit 1; }
echo "ENABLE_VERIFICATION_OK"

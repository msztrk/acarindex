#!/usr/bin/env bash
# Parola sıfırlama flag açımı (doğrulama kabul sonrası)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
BASE_LOCAL="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"

acar_beta_require_pilot

set_kv() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$PILOT_ENV"; then sed -i "s/^${key}=.*/${key}=${val}/" "$PILOT_ENV"; else echo "${key}=${val}" >> "$PILOT_ENV"; fi
}

set_kv ENABLE_PASSWORD_RESET 1
set_kv ENABLE_PUBLIC_REGISTRATION 0

$ACAR_COMPOSE --profile app up -d --no-deps app
sleep 20
flags=$(curl -s "$BASE_LOCAL/api/features")
echo "$flags"
echo "$flags" | grep -q '"passwordReset":true' || exit 1
echo "ENABLE_PASSWORD_RESET_OK"

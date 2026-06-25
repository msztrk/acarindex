#!/usr/bin/env bash
# Parola sıfırlama kabul (sunucu — sentetik token testleri)
set -Eeuo pipefail

ROOT="${ACAR_ROOT:-/opt/acarindex}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
PASSMAP="/root/.faz6c-beta-mail-test-pass"

acar_beta_require_pilot
cd "$ROOT"

NEW_PASS=$(grep '^pass=' "$PASSMAP" | cut -d= -f2- | tr -d '\r')
[[ -n "$NEW_PASS" ]] || { echo "FAIL: passmap"; exit 1; }

docker compose --env-file "$PILOT_ENV" -f /opt/acarindex/docker-compose.pilot.yml --profile tools run --rm \
  -e ACAR_BETA_MAIL_TEST_EMAIL \
  -e NEW_PASS="$NEW_PASS" \
  etl scripts/test/beta-mail-reset-acceptance.ts

echo "RESET_ACCEPTANCE_SCRIPT_OK"

#!/usr/bin/env bash
# Test kullanıcı temizliği (msztrk@gmail.com korunur)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
TEST_EMAIL=$(grep '^ACAR_BETA_MAIL_TEST_EMAIL=' "$PILOT_ENV" | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')

acar_beta_require_pilot

echo "=== DELETE TEST USER DATA ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "DELETE FROM login_attempts WHERE email = '$TEST_EMAIL';"

deleted=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "WITH doomed AS (SELECT id FROM users WHERE email = '$TEST_EMAIL'),
   del AS (DELETE FROM users WHERE id IN (SELECT id FROM doomed) RETURNING id)
   SELECT count(*) FROM del;")
echo "deleted=$deleted"

real=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM users WHERE email = 'msztrk@gmail.com';")
[[ "$real" == "1" ]] || { echo "FAIL: real user"; exit 1; }

users=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc "SELECT count(*) FROM users;")
echo "users=$users"
[[ "$users" == "1" ]] || { echo "FAIL: users count"; exit 1; }
echo "TEST_USER_CLEANUP_OK"

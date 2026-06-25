#!/usr/bin/env bash
# Beta B test kullanıcısı (public registration olmadan)
set -Eeuo pipefail

ROOT="${ACAR_ROOT:-/opt/acarindex}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
TEST_EMAIL=$(grep '^ACAR_BETA_MAIL_TEST_EMAIL=' "$PILOT_ENV" | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
PASSMAP="/root/.faz6c-beta-mail-test-pass"

acar_beta_require_pilot
cd "$ROOT"

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "DELETE FROM users WHERE email = '$TEST_EMAIL';" 2>/dev/null || true

AUTHORS_BEFORE=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc "SELECT count(*) FROM authors;")
TEST_PASS=$(openssl rand -base64 16 | tr -d '/+=' | head -c 16)
echo "pass=$TEST_PASS" > "$PASSMAP"
chmod 600 "$PASSMAP"

docker compose --env-file "$PILOT_ENV" -f /opt/acarindex/docker-compose.pilot.yml --profile tools run --rm \
  -e NEW_PASS="$TEST_PASS" etl scripts/auth/create-beta-mail-test-user.ts "$TEST_EMAIL" 2>&1 | tail -5

UID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT id FROM users WHERE email='$TEST_EMAIL';")
[[ -n "$UID" ]] || { echo "FAIL: user missing"; exit 1; }

VERIFIED=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT email_verified IS NULL FROM users WHERE email='$TEST_EMAIL';")
[[ "$VERIFIED" == "t" ]] || { echo "FAIL: should be unverified"; exit 1; }

AUTHORS_AFTER=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc "SELECT count(*) FROM authors;")
[[ "$AUTHORS_BEFORE" == "$AUTHORS_AFTER" ]] || { echo "FAIL: authors changed"; exit 1; }

echo "BETA_TEST_USER_OK"

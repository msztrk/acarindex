#!/usr/bin/env bash
# Faz 6B.2 — remove beta test users (@acarindex-beta.invalid), keep real accounts.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

KEEP_EMAIL="${ACAR_KEEP_USER_EMAIL:-msztrk@gmail.com}"
TEST_DOMAIN="@acarindex-beta.invalid"

acar_beta_require_pilot

echo "=== USERS BEFORE ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT id, email, status FROM users ORDER BY email;"

echo "=== DELETE LOGIN ATTEMPTS (test domain) ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "DELETE FROM login_attempts WHERE email LIKE '%${TEST_DOMAIN}';"

echo "=== DELETE TEST USERS ==="
deleted=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "WITH doomed AS (
     SELECT id FROM users WHERE email LIKE '%${TEST_DOMAIN}' AND email <> '$KEEP_EMAIL'
   ), del AS (
     DELETE FROM users WHERE id IN (SELECT id FROM doomed) RETURNING id
   ) SELECT count(*) FROM del;")

echo "deleted_test_users=$deleted"

keep_count=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM users WHERE email = '$KEEP_EMAIL';")
[[ "$keep_count" == "1" ]] || { echo "FAIL: keep user missing" >&2; exit 1; }

echo "=== USERS AFTER ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT count(*) AS users_total FROM users;
   SELECT id, email, status FROM users ORDER BY email;"

echo "CLEANUP_TEST_USERS_OK"

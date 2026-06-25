#!/usr/bin/env bash
# Faz 6C-Beta A — dark deploy smoke + lifecycle test user
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

CRED="${ACAR_ADMIN_CRED:-/root/.faz6a-admin-credentials}"
BASE="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"
TEST_EMAIL="faz6c-lifecycle@acarindex-beta.invalid"
TEST_PASSMAP="/root/.faz6c-lifecycle-test-pass"
CJ=""
NGX_USER=""
TMP_PDF=""

cleanup() {
  if [[ -n "$NGX_USER" ]]; then
    htpasswd -D /etc/nginx/.htpasswd-acarindex-beta "$NGX_USER" 2>/dev/null || true
  fi
  rm -f "$CJ" "$TMP_PDF"
}
trap cleanup EXIT

fail() { echo "FAIL: $1" >&2; exit 1; }
trim() { acar_beta_trim; }

acar_beta_require_pilot

NGX_USER="faz6c_probe_$(date +%s)"
NGX_PASS=$(openssl rand -base64 12 | tr -d '/+=' | head -c 12)
htpasswd -bB /etc/nginx/.htpasswd-acarindex-beta "$NGX_USER" "$NGX_PASS" 2>/dev/null
AUTH_NGX="-u ${NGX_USER}:${NGX_PASS}"

echo "=== FEATURE FLAGS API ==="
flags=$(curl -sS $AUTH_NGX "$BASE/api/features")
echo "$flags"
echo "$flags" | grep -q '"publicRegistration":false' || fail "publicRegistration not false"
echo "$flags" | grep -q '"emailVerification":false' || fail "emailVerification not false"
echo "$flags" | grep -q '"passwordReset":false' || fail "passwordReset not false"

echo "=== DARK ROUTES ==="
reg_html=$(curl -sS $AUTH_NGX "$BASE/register")
echo "$reg_html" | grep -qi 'yakında' || echo "$reg_html" | grep -qi 'kapalı' || fail "register not closed message"

code=$(curl -sS $AUTH_NGX -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" -d '{"email":"dark@test.invalid","password":"SecurePass123!","acceptedDocumentIds":[]}' \
  -o /dev/null -w '%{http_code}')
[[ "$code" == "400" || "$code" == "403" ]] || fail "register API $code"

fp=$(curl -sS $AUTH_NGX -X POST "$BASE/api/auth/forgot-password" \
  -H "Content-Type: application/json" -d '{"email":"nobody@test.invalid"}')
echo "$fp"
echo "$fp" | grep -qi 'gönderildi' || fail "forgot generic"

vt_before=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM verification_tokens WHERE created_at > now() - interval '5 minutes';" | trim)
curl -sS $AUTH_NGX -X POST "$BASE/api/auth/resend-verification" \
  -H "Content-Type: application/json" -d '{"email":"msztrk@gmail.com"}' >/dev/null
vt_after=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM verification_tokens WHERE created_at > now() - interval '5 minutes';" | trim)
[[ "$vt_after" == "$vt_before" ]] || fail "verification tokens created when flag off"

prt_before=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM password_reset_tokens WHERE created_at > now() - interval '5 minutes';" | trim)
curl -sS $AUTH_NGX -X POST "$BASE/api/auth/forgot-password" \
  -H "Content-Type: application/json" -d '{"email":"msztrk@gmail.com"}' >/dev/null
prt_after=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM password_reset_tokens WHERE created_at > now() - interval '5 minutes';" | trim)
[[ "$prt_after" == "$prt_before" ]] || fail "reset tokens created when flag off"

echo "=== CATALOG (abbrev) ==="
for path in / /search?q=enerji /journals /istatistikler /sitemap.xml; do
  code=$(curl -sS $AUTH_NGX -o /dev/null -w '%{http_code}' "$BASE$path")
  echo "$path:$code"
  [[ "$code" == "200" ]] || fail "$path"
done
robots=$(curl -sS $AUTH_NGX "$BASE/robots.txt")
echo "$robots" | grep -q 'Disallow: /' || fail "robots"
hdr=$(curl -sS $AUTH_NGX -I "$BASE/" | tr -d '\r' | grep -i x-robots-tag || true)
echo "x-robots:$hdr"
echo "$hdr" | grep -qi noindex || fail "noindex"

echo "=== REAL USER LOGIN (if cred file) ==="
if [[ -f "$CRED" ]]; then
  EMAIL=$(grep '^email=' "$CRED" | cut -d= -f2- | tr -d '\r')
  PASS=$(grep '^pass=' "$CRED" | cut -d= -f2- | tr -d '\r')
  CJ="/tmp/faz6c-cookies-$$.txt"
  rm -f "$CJ"
  csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
  login_code=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" -o /dev/null -w '%{http_code}')
  echo "credential_login:$login_code"
  if [[ "$login_code" == "200" ]]; then
    for path in /hesabim /hesabim/security /admin /admin/users; do
      code=$(curl -sS $AUTH_NGX -b "$CJ" -o /dev/null -w '%{http_code}' "$BASE$path")
      echo "$path:$code"
      [[ "$code" == "200" ]] || fail "$path"
    done
    sess=$(curl -sS $AUTH_NGX -b "$CJ" "$BASE/api/auth/sessions")
    echo "sessions:${sess:0:120}..."
    # Second session for revoke test
    csrf2=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
    curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/auth/login" \
      -H "Content-Type: application/json" -H "x-csrf-token: $csrf2" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" -o /dev/null
    sess2=$(curl -sS $AUTH_NGX -b "$CJ" "$BASE/api/auth/sessions")
    OTHER_ID=$(echo "$sess2" | sed -n 's/.*"id":"\([^"]*\)".*"isCurrent":false.*/\1/p' | head -1)
    if [[ -n "$OTHER_ID" ]]; then
      csrf3=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
      code=$(curl -sS -b "$CJ" -X DELETE "$BASE/api/auth/sessions/$OTHER_ID" \
        -H "Content-Type: application/json" -H "x-csrf-token: $csrf3" -d '{}' -o /dev/null -w '%{http_code}')
      echo "revoke_other_session:$code"
      [[ "$code" == "200" ]] || fail "revoke session"
    fi
  else
    echo "SKIP session tests — credential login failed (password may have been changed)"
  fi
else
  echo "SKIP real user login — no credential file"
fi

echo "=== LIFECYCLE TEST USER ==="
AUTHORS_BEFORE=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc "SELECT count(*) FROM authors;" | trim)
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "DELETE FROM users WHERE email = '$TEST_EMAIL';" 2>/dev/null || true
TEST_PASS=$(openssl rand -base64 16 | tr -d '/+=' | head -c 16)
echo "${TEST_EMAIL}=${TEST_PASS}" > "$TEST_PASSMAP"
chmod 600 "$TEST_PASSMAP"
docker compose --env-file /etc/acarindex/pilot.env -f /opt/acarindex/docker-compose.pilot.yml --profile tools run --rm \
  -e NEW_PASS="$TEST_PASS" etl scripts/auth/create-role-test-user.ts "$TEST_EMAIL" USER 2>&1 | tail -3
TEST_UID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT id FROM users WHERE email='$TEST_EMAIL';" | trim)
[[ -n "$TEST_UID" ]] || fail "test user missing"

CJ2="/tmp/faz6c-test-$$.txt"
rm -f "$CJ2"
csrf=$(curl -sS -b "$CJ2" -c "$CJ2" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
curl -sS -b "$CJ2" -c "$CJ2" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}" -o /dev/null
grep -q acarindex_session "$CJ2" || fail "test login"

sess=$(curl -sS $AUTH_NGX -b "$CJ2" "$BASE/api/auth/sessions")
echo "test_sessions:${sess:0:80}..."

csrf=$(curl -sS -b "$CJ2" -c "$CJ2" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
code=$(curl -sS -b "$CJ2" -X POST "$BASE/api/auth/account" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"action\":\"request_deletion\",\"password\":\"$TEST_PASS\"}" -o /dev/null -w '%{http_code}')
echo "deletion_request:$code"
[[ "$code" == "200" ]] || fail "deletion request"

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT status, scheduled_for::date FROM account_deletion_requests WHERE user_id='$TEST_UID' ORDER BY requested_at DESC LIMIT 1;"

rm -f "$CJ2"
csrf=$(curl -sS -b "$CJ2" -c "$CJ2" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
curl -sS -b "$CJ2" -c "$CJ2" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}" -o /dev/null
grep -q acarindex_session "$CJ2" || fail "re-login after deletion request"

csrf=$(curl -sS -b "$CJ2" -c "$CJ2" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
code=$(curl -sS -b "$CJ2" -X POST "$BASE/api/auth/account" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d '{"action":"cancel_deletion"}' -o /dev/null -w '%{http_code}')
echo "cancel_deletion:$code"
[[ "$code" == "200" ]] || fail "cancel deletion"

AUTHORS_AFTER=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc "SELECT count(*) FROM authors;" | trim)
[[ "$AUTHORS_BEFORE" == "$AUTHORS_AFTER" ]] || fail "authors count changed"

echo "=== CLEANUP TEST USER ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "DELETE FROM users WHERE email='$TEST_EMAIL';"
rm -f "$TEST_PASSMAP"

echo "=== LEGAL PLACEHOLDER ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT type, version, required FROM legal_documents ORDER BY type;"
grep -q placeholder docs/auth/lifecycle.md || fail "lifecycle docs"

echo "=== TOKEN STORAGE ==="
raw=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM sessions WHERE length(token_hash) < 32;" | trim)
[[ "$raw" == "0" ]] || fail "short session tokens"

echo "FAZ6C_BETA_A_SMOKE_OK"

#!/usr/bin/env bash
# faz-b2-beta-storage-tests.sh — 18 API storage checks on beta (memory or b2).
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

CRED="${ACAR_ADMIN_CRED:-/root/.faz6a-admin-credentials}"
BASE="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"
PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
CJ=""
OTHER_CJ=""
TMPDIR=""
PASS=0
FAIL=0
PERSIST_ATT_ID=""

cleanup() {
  rm -rf "$TMPDIR" "$CJ" "$OTHER_CJ"
}
trap cleanup EXIT

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1" >&2; FAIL=$((FAIL + 1)); }

fetch_csrf() {
  local jar="$1"
  curl -sS -b "$jar" -c "$jar" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p'
}

login_user() {
  local jar="$1" email="$2" pass="$3"
  local csrf
  csrf=$(fetch_csrf "$jar")
  curl -sS -b "$jar" -c "$jar" -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
    -d "{\"email\":\"$email\",\"password\":\"$pass\"}" -o /dev/null
  grep -q acarindex_session "$jar"
}

minimal_png() {
  printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xdb\x00\x00\x00\x00IEND\xaeB`\x82'
}

minimal_pdf() {
  printf '%%PDF-1.4\n%%EOF'
}

upload_file() {
  local jar="$1" app_id="$2" kind="$3" file_path="$4" mime="$5"
  local csrf
  csrf=$(fetch_csrf "$jar")
  curl -sS -b "$jar" -c "$jar" -X POST "$BASE/api/applications/$app_id/attachments" \
    -H "x-csrf-token: $csrf" \
    -F "kind=$kind" \
    -F "file=@${file_path};type=${mime}"
}

acar_beta_require_pilot
TMPDIR=$(mktemp -d)
CJ="$TMPDIR/owner.cj"
OTHER_CJ="$TMPDIR/other.cj"

EMAIL=$(grep '^email=' "$CRED" | cut -d= -f2- | tr -d '\r')
PASS=$(grep '^pass=' "$CRED" | cut -d= -f2- | tr -d '\r')
[[ -n "$EMAIL" && -n "$PASS" ]] || { fail "credentials"; exit 1; }

PROVIDER=$(grep '^APPLICATION_STORAGE_PROVIDER=' "$PILOT_ENV" | cut -d= -f2- | tr -d '\r')
echo "STORAGE_PROVIDER=$PROVIDER"

echo "=== TEST 1 create journal application ==="
login_user "$CJ" "$EMAIL" "$PASS" && pass "login" || fail "login"
csrf=$(fetch_csrf "$CJ")
create_json=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/applications/journal" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf")
APP_ID=$(echo "$create_json" | sed -n 's/.*"contentApplicationId":"\([^"]*\)".*/\1/p')
[[ -n "$APP_ID" ]] && pass "create journal app $APP_ID" || fail "create journal app"

echo "=== TEST 2 upload cover PNG ==="
printf '%s' "$(minimal_png)" > "$TMPDIR/cover.png"
cover_json=$(upload_file "$CJ" "$APP_ID" cover_image "$TMPDIR/cover.png" image/png)
COVER_ID=$(echo "$cover_json" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
[[ -n "$COVER_ID" ]] && pass "upload cover" || fail "upload cover: $cover_json"

echo "=== TEST 3 upload proof PDF ==="
printf '%s' "$(minimal_pdf)" > "$TMPDIR/proof.pdf"
proof_json=$(upload_file "$CJ" "$APP_ID" proof_document "$TMPDIR/proof.pdf" application/pdf)
PROOF_ID=$(echo "$proof_json" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
[[ -n "$PROOF_ID" ]] && pass "upload proof" || fail "upload proof: $proof_json"

echo "=== TEST 4 list attachments ==="
list_json=$(curl -sS -b "$CJ" "$BASE/api/applications/$APP_ID/attachments")
echo "$list_json" | grep -q "$COVER_ID" && echo "$list_json" | grep -q "$PROOF_ID" && pass "list attachments" || fail "list attachments"

echo "=== TEST 5 unauth GET attachments ==="
code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/applications/$APP_ID/attachments")
[[ "$code" == "401" ]] && pass "unauth list 401" || fail "unauth list $code"

echo "=== TEST 6 other user GET attachments ==="
OTHER_EMAIL="fazb_storage_$(date +%s)@beta.local"
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -v ON_ERROR_STOP=1 <<EOSQL
WITH admin_cred AS (
  SELECT password_hash FROM user_credentials uc
  JOIN users u ON u.id = uc.user_id WHERE u.email = '$EMAIL' LIMIT 1
),
ins AS (
  INSERT INTO users (email, email_verified, status)
  VALUES ('$OTHER_EMAIL', NOW(), 'active')
  RETURNING id
)
INSERT INTO user_credentials (user_id, password_hash)
SELECT ins.id, admin_cred.password_hash FROM ins, admin_cred;
EOSQL
login_user "$OTHER_CJ" "$OTHER_EMAIL" "$PASS" && pass "other login" || fail "other login"
code=$(curl -sS -b "$OTHER_CJ" -o /dev/null -w '%{http_code}' "$BASE/api/applications/$APP_ID/attachments")
[[ "$code" == "403" ]] && pass "other user list 403" || fail "other user list $code"

echo "=== TEST 7 unauth POST attachment ==="
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/api/applications/$APP_ID/attachments" \
  -F "kind=cover_image" -F "file=@$TMPDIR/cover.png;type=image/png")
[[ "$code" == "401" ]] && pass "unauth upload 401" || fail "unauth upload $code"

echo "=== TEST 8 other user POST attachment ==="
csrf=$(fetch_csrf "$OTHER_CJ")
code=$(curl -sS -b "$OTHER_CJ" -c "$OTHER_CJ" -o /dev/null -w '%{http_code}' \
  -X POST "$BASE/api/applications/$APP_ID/attachments" \
  -H "x-csrf-token: $csrf" \
  -F "kind=cover_image" -F "file=@$TMPDIR/cover.png;type=image/png")
[[ "$code" == "403" ]] && pass "other user upload 403" || fail "other user upload $code"

echo "=== TEST 9 POST without CSRF ==="
code=$(curl -sS -b "$CJ" -c "$CJ" -o /dev/null -w '%{http_code}' \
  -X POST "$BASE/api/applications/$APP_ID/attachments" \
  -F "kind=cover_image" -F "file=@$TMPDIR/cover.png;type=image/png")
[[ "$code" == "403" ]] && pass "missing csrf 403" || fail "missing csrf $code"

echo "=== TEST 10 reject bad mime cover ==="
printf 'hello' > "$TMPDIR/bad.txt"
bad_json=$(upload_file "$CJ" "$APP_ID" cover_image "$TMPDIR/bad.txt" text/plain)
echo "$bad_json" | grep -qi 'error' && pass "reject bad mime" || fail "reject bad mime"

echo "=== TEST 11 reject oversized cover ==="
dd if=/dev/zero of="$TMPDIR/big.png" bs=1M count=3 2>/dev/null
printf '\x89PNG\r\n\x1a\n' | dd of="$TMPDIR/big.png" conv=notrunc 2>/dev/null
big_json=$(upload_file "$CJ" "$APP_ID" cover_image "$TMPDIR/big.png" image/png)
echo "$big_json" | grep -qi 'error\|boyut' && pass "reject oversized" || fail "reject oversized"

echo "=== TEST 12 reject proof non-pdf ==="
bad_proof=$(upload_file "$CJ" "$APP_ID" proof_document "$TMPDIR/cover.png" image/png)
echo "$bad_proof" | grep -qi 'error\|PDF' && pass "reject non-pdf proof" || fail "reject non-pdf proof"

echo "=== TEST 13 owner download ==="
code=$(curl -sS -b "$CJ" -o /dev/null -w '%{http_code}' \
  "$BASE/api/applications/$APP_ID/attachments/$COVER_ID/download")
[[ "$code" == "302" || "$code" == "200" ]] && pass "owner download $code" || fail "owner download $code"

echo "=== TEST 14 other user download ==="
code=$(curl -sS -b "$OTHER_CJ" -o /dev/null -w '%{http_code}' \
  "$BASE/api/applications/$APP_ID/attachments/$COVER_ID/download")
[[ "$code" == "403" ]] && pass "other download 403" || fail "other download $code"

echo "=== TEST 15 delete attachment ==="
csrf=$(fetch_csrf "$CJ")
code=$(curl -sS -b "$CJ" -c "$CJ" -o /dev/null -w '%{http_code}' \
  -X DELETE "$BASE/api/applications/$APP_ID/attachments/$PROOF_ID" \
  -H "x-csrf-token: $csrf")
[[ "$code" == "200" ]] && pass "delete attachment" || fail "delete attachment $code"

echo "=== TEST 16 verify deleted ==="
list_after=$(curl -sS -b "$CJ" "$BASE/api/applications/$APP_ID/attachments")
echo "$list_after" | grep -q "$PROOF_ID" && fail "proof still listed" || pass "proof removed from list"

echo "=== TEST 17 container restart persistence ==="
persist_json=$(upload_file "$CJ" "$APP_ID" cover_image "$TMPDIR/cover.png" image/png)
PERSIST_ATT_ID=$(echo "$persist_json" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
$ACAR_COMPOSE --profile app restart app
sleep 25
curl -sf "$BASE/api/health" >/dev/null && pass "health after restart" || fail "health after restart"
code=$(curl -sS -b "$CJ" -o /dev/null -w '%{http_code}' \
  "$BASE/api/applications/$APP_ID/attachments/$PERSIST_ATT_ID/download")
[[ "$code" == "302" || "$code" == "200" ]] && pass "persistence after restart" || fail "persistence $code"

echo "=== TEST 18 provider still configured ==="
PROVIDER_AFTER=$(grep '^APPLICATION_STORAGE_PROVIDER=' "$PILOT_ENV" | cut -d= -f2- | tr -d '\r')
[[ "$PROVIDER_AFTER" == "$PROVIDER" ]] && pass "provider unchanged ($PROVIDER_AFTER)" || fail "provider changed"

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "DELETE FROM users WHERE email = '$OTHER_EMAIL';" >/dev/null 2>&1 || true

echo "=== SUMMARY pass=$PASS fail=$FAIL provider=$PROVIDER_AFTER app=$APP_ID ==="
[[ "$FAIL" -eq 0 ]] && echo "OK: faz-b2-beta-storage-tests passed" && exit 0
exit 1

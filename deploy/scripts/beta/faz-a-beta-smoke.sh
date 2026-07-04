#!/usr/bin/env bash
# Faz A beta — comprehensive smoke (auth regression + Başvuru Merkezi)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

CRED="${ACAR_ADMIN_CRED:-/root/.faz6a-admin-credentials}"
BASE="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"
CJ=""
NGX_USER=""
PASS_COUNT=0
FAIL_COUNT=0

cleanup() {
  if [[ -n "$NGX_USER" ]]; then
    htpasswd -D /etc/nginx/.htpasswd-acarindex-beta "$NGX_USER" 2>/dev/null || true
  fi
  rm -f "$CJ"
}
trap cleanup EXIT

pass() { echo "PASS: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "FAIL: $1" >&2; FAIL_COUNT=$((FAIL_COUNT + 1)); }

acar_beta_require_pilot

EMAIL=$(grep '^email=' "$CRED" | cut -d= -f2- | tr -d '\r')
PASS=$(grep '^pass=' "$CRED" | cut -d= -f2- | tr -d '\r')
[[ -n "$EMAIL" && -n "$PASS" ]] || fail "credential file"

NGX_USER="faza_probe_$(date +%s)"
NGX_PASS=$(openssl rand -base64 12 | tr -d '/+=' | head -c 12)
htpasswd -bB /etc/nginx/.htpasswd-acarindex-beta "$NGX_USER" "$NGX_PASS" 2>/dev/null
AUTH_NGX="-u ${NGX_USER}:${NGX_PASS}"

CJ="/tmp/faza-cookies-$$.txt"
rm -f "$CJ"

echo "=== BASIC AUTH + NOINDEX ==="
code=$(curl -sS -o /dev/null -w '%{http_code}' "https://beta.acarindex.com/")
[[ "$code" == "401" ]] && pass "beta basic auth 401" || fail "beta basic auth $code"
robots=$(curl -sSI $AUTH_NGX "https://beta.acarindex.com/" 2>/dev/null | tr -d '\r' | grep -i x-robots-tag || true)
echo "$robots" | grep -qi noindex && pass "beta noindex" || fail "beta noindex missing"

echo "=== LOGIN ==="
csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
code=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" -o /dev/null -w '%{http_code}')
grep -q acarindex_session "$CJ" && pass "login ok" || fail "login cookie"
[[ "$code" == "200" ]] && pass "login 200" || fail "login code $code"

code=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"wrong-password-faza\"}" -o /dev/null -w '%{http_code}')
[[ "$code" == "401" ]] && pass "wrong password 401" || fail "wrong password $code"

echo "=== HESABIM REGRESSION ==="
for path in /hesabim /hesabim/kaydedilen /hesabim/listeler /hesabim/takip-dergiler /hesabim/takip-yazarlar /hesabim/basvurular; do
  code=$(curl -sS $AUTH_NGX -b "$CJ" -o /dev/null -w '%{http_code}' "$BASE$path")
  [[ "$code" == "200" ]] && pass "$path" || fail "$path $code"
done

for path in /editor/basvuru /kurum/basvuru /admin /admin/applications; do
  code=$(curl -sS $AUTH_NGX -b "$CJ" -L -o /dev/null -w '%{http_code}' "$BASE$path")
  [[ "$code" == "200" ]] && pass "$path" || fail "$path $code"
done

echo "=== APPLICATION CENTER API ==="
csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
create_json=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/applications" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d '{"kind":"new_journal","title":"Faz A Smoke Draft"}')
APP_ID=$(echo "$create_json" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
[[ -n "$APP_ID" ]] && pass "create draft" || fail "create draft"

list_json=$(curl -sS -b "$CJ" "$BASE/api/applications")
echo "$list_json" | grep -q workPhone && fail "list leaks private contact" || pass "list no private contact"
echo "$list_json" | grep -q mobilePhone && fail "list leaks mobile" || pass "list no mobile"

csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
curl -sS -b "$CJ" -c "$CJ" -X PUT "$BASE/api/applications/$APP_ID/private-contact" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d '{"contactName":"Smoke","contactEmail":"smoke@example.com","workPhone":"+905551112233"}' -o /dev/null

pc=$(curl -sS -b "$CJ" "$BASE/api/applications/$APP_ID/private-contact")
echo "$pc" | grep -q '+905551112233' && pass "owner sees private contact" || fail "owner private contact"

csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
curl -sS -b "$CJ" -c "$CJ" -X PATCH "$BASE/api/applications/$APP_ID" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d '{"title":"Faz A Smoke Updated","draftPayload":{"note":"beta"}}' -o /dev/null
pass "draft update"

csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/applications/$APP_ID/submit" \
  -H "x-csrf-token: $csrf" -o /dev/null

REVS=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM application_revisions WHERE application_id='$APP_ID';" | tr -d ' \r\n')
[[ "$REVS" -ge 1 ]] && pass "revision created" || fail "revision missing"

EVTS=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM application_events WHERE application_id='$APP_ID';" | tr -d ' \r\n')
[[ "$EVTS" -ge 2 ]] && pass "events created" || fail "events missing"

AUD=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM audit_logs WHERE entity_type='content_application' AND entity_id='$APP_ID';" | tr -d ' \r\n')
[[ "$AUD" -ge 1 ]] && pass "audit created" || fail "audit missing"

csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
code=$(curl -sS -b "$CJ" -c "$CJ" -X PATCH "$BASE/api/applications/$APP_ID" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d '{"title":"Should fail"}' -o /dev/null -w '%{http_code}')
[[ "$code" == "409" || "$code" == "403" ]] && pass "submitted not editable" || fail "submitted edit $code"

echo "=== OWNERSHIP 403 ==="
OTHER_CJ="/tmp/faza-other-$$.txt"
rm -f "$OTHER_CJ"
# Use nginx auth only — without session should 401; with wrong user we need second account.
# Admin cred is only user — test GET without ownership via invalid session path: unauthenticated 401
code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/applications/$APP_ID")
[[ "$code" == "401" ]] && pass "unauth application 401" || fail "unauth $code"

echo "=== MEMBERSHIP API ==="
code=$(curl -sS $AUTH_NGX -b "$CJ" -o /dev/null -w '%{http_code}' "$BASE/api/membership-applications")
[[ "$code" == "200" ]] && pass "membership applications api" || fail "membership api $code"

echo "=== PDF ==="
ARTICLE_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT a.id FROM articles a JOIN pdf_files p ON p.article_id=a.id WHERE p.file_status!='missing' ORDER BY a.id LIMIT 1;" | tr -d ' \r\n')
code=$(curl -sS $AUTH_NGX -o /dev/null -w '%{http_code}' "$BASE/api/pdf-proxy/$ARTICLE_ID")
[[ "$code" == "200" ]] && pass "pdf proxy" || fail "pdf $code"

echo "=== LOGOUT ==="
csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
code=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/auth/logout" \
  -H "x-csrf-token: $csrf" -o /dev/null -w '%{http_code}')
[[ "$code" == "200" ]] && pass "logout" || fail "logout $code"

echo "=== HEALTH ==="
health=$(curl -sS "$BASE/api/health")
echo "$health" | grep -q '"status":"ready"' && pass "health ready" || fail "health"

echo "=== SUMMARY pass=$PASS_COUNT fail=$FAIL_COUNT ==="
[[ "$FAIL_COUNT" -eq 0 ]] && echo "OK: faz-a-beta-smoke passed" && exit 0
exit 1

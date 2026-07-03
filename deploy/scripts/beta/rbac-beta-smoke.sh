#!/usr/bin/env bash
# RBAC + panel smoke — beta only (auth login, editor/kurum shells, forbidden paths)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

CRED="${ACAR_ADMIN_CRED:-/root/.faz6a-admin-credentials}"
BASE="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"
CJ=""
NGX_USER=""

cleanup() {
  if [[ -n "$NGX_USER" ]]; then
    htpasswd -D /etc/nginx/.htpasswd-acarindex-beta "$NGX_USER" 2>/dev/null || true
  fi
  rm -f "$CJ"
}
trap cleanup EXIT

fail() { echo "FAIL: $1" >&2; exit 1; }

acar_beta_require_pilot

if [[ ! -f "$CRED" ]]; then
  echo "FAIL: credential file missing (set ACAR_ADMIN_CRED)" >&2
  exit 1
fi

EMAIL=$(grep '^email=' "$CRED" | cut -d= -f2- | tr -d '\r')
PASS=$(grep '^pass=' "$CRED" | cut -d= -f2- | tr -d '\r')
[[ -n "$EMAIL" && -n "$PASS" ]] || fail "credential file format"

NGX_USER="rbac_probe_$(date +%s)"
NGX_PASS=$(openssl rand -base64 12 | tr -d '/+=' | head -c 12)
htpasswd -bB /etc/nginx/.htpasswd-acarindex-beta "$NGX_USER" "$NGX_PASS" 2>/dev/null
AUTH_NGX="-u ${NGX_USER}:${NGX_PASS}"

echo "=== PUBLIC ROUTES ==="
for path in /api/health /forbidden /login; do
  code=$(curl -sS $AUTH_NGX -o /dev/null -w '%{http_code}' "$BASE$path")
  echo "$path:$code"
  [[ "$code" == "200" ]] || fail "$path"
done

echo "=== UNAUTH EDITOR REDIRECT ==="
code=$(curl -sS $AUTH_NGX -o /dev/null -w '%{http_code}' "$BASE/editor")
[[ "$code" == "307" || "$code" == "302" ]] || fail "unauth editor redirect $code"

CJ="/tmp/rbac-cookies-$$.txt"
rm -f "$CJ"
csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
[[ -n "$csrf" ]] || fail "csrf"

curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" -o /dev/null
grep -q acarindex_session "$CJ" || fail "session cookie"

echo "=== AUTH PANEL SHELLS ==="
for path in /editor /editor/basvuru /kurum /kurum/basvuru /hesabim; do
  code=$(curl -sS $AUTH_NGX -b "$CJ" -o /dev/null -w '%{http_code}' "$BASE$path")
  echo "$path:$code"
  [[ "$code" == "200" ]] || fail "$path"
done

echo "=== PANEL APIs ==="
for path in /api/editor/journals /api/institution/memberships /api/membership-applications /api/change-requests; do
  code=$(curl -sS $AUTH_NGX -b "$CJ" -o /dev/null -w '%{http_code}' "$BASE$path")
  echo "$path:$code"
  [[ "$code" == "200" ]] || fail "$path"
done

JOURNAL_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT id FROM journals ORDER BY id LIMIT 1;" | tr -d ' \r\n')
[[ -n "$JOURNAL_ID" ]] || fail "journal id"

echo "=== FORBIDDEN JOURNAL PANEL ==="
code=$(curl -sS $AUTH_NGX -b "$CJ" -o /dev/null -w '%{http_code}' -L "$BASE/editor/${JOURNAL_ID}")
echo "/editor/${JOURNAL_ID}:$code"
[[ "$code" == "200" ]] || fail "forbidden journal panel"
body=$(curl -sS $AUTH_NGX -b "$CJ" -L "$BASE/editor/${JOURNAL_ID}")
echo "$body" | grep -qi 'Erişim reddedildi' || fail "expected forbidden page content"

echo "=== LOGOUT ==="
csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
code=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/auth/logout" \
  -H "x-csrf-token: $csrf" -o /dev/null -w '%{http_code}')
[[ "$code" == "200" ]] || fail "logout $code"

echo "OK: rbac-beta-smoke passed"

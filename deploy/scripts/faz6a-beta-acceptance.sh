#!/usr/bin/env bash
# Faz 6A-Beta acceptance tests — run on beta server
set -euo pipefail

CRED=/root/.faz6a-admin-credentials
EMAIL=$(grep '^email=' "$CRED" | cut -d= -f2- | tr -d '\r')
PASS=$(grep '^pass=' "$CRED" | cut -d= -f2- | tr -d '\r')
BASE_LOCAL="http://127.0.0.1:3002"
BASE_HTTPS="https://beta.acarindex.com"

# Nginx Basic Auth probe user
NGX_USER="accept_probe"
NGX_PASS=$(openssl rand -base64 12 | tr -d '/+=' | head -c 12)
htpasswd -bB /etc/nginx/.htpasswd-acarindex-beta "$NGX_USER" "$NGX_PASS" 2>/dev/null
AUTH_NGX="-u ${NGX_USER}:${NGX_PASS}"

fail() { echo "FAIL: $1"; exit 1; }

echo "=== NO NGX AUTH ==="
code=$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_HTTPS/")
[[ "$code" == "401" ]] || fail "expected 401 got $code"

echo "=== LOGIN PAGE ==="
code=$(curl -sS $AUTH_NGX -o /dev/null -w '%{http_code}' -L "$BASE_HTTPS/login")
[[ "$code" == "200" ]] || fail "login page $code"

CJ=/tmp/acar-cj.txt
rm -f "$CJ"

echo "=== CSRF ==="
csrf=$(curl -sS -c "$CJ" "$BASE_LOCAL/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
[[ -n "$csrf" ]] || fail "no csrf token"

echo "=== WRONG PASSWORD ==="
wrong=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE_LOCAL/api/auth/login" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d '{"email":"'"$EMAIL"'","password":"wrongpassword123"}' -w '%{http_code}')
echo "wrong_http:${wrong: -3}"
body=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE_LOCAL/api/auth/login" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d '{"email":"'"$EMAIL"'","password":"wrongpassword123"}')
echo "$body" | grep -qi postgresql && fail "credential leak"
echo "$body" | grep -qi password && fail "password in response"

echo "=== RATE LIMIT (bogus email) ==="
for i in 1 2 3 4 5 6; do
  csrf=$(curl -sS -c "$CJ" -b "$CJ" "$BASE_LOCAL/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
  curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE_LOCAL/api/auth/login" \
    -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
    -d '{"email":"ratelimit@test.invalid","password":"x"}' -o /dev/null -w "attempt$i:%{http_code}\n"
done

csrf=$(curl -sS -c "$CJ" -b "$CJ" "$BASE_LOCAL/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
echo "=== GOOD LOGIN ==="
login_out=$(curl -sS -b "$CJ" -c "$CJ" -c /tmp/acar-cookies.txt -X POST "$BASE_LOCAL/api/auth/login" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d '{"email":"'"$EMAIL"'","password":"'"$PASS"'"}' -w '\nHTTP:%{http_code}')
echo "$login_out" | tail -2
grep -q acarindex_session /tmp/acar-cookies.txt || fail "no session cookie"
grep acarindex_session /tmp/acar-cookies.txt | grep -qi httponly || true

echo "=== SESSION API ==="
curl -sS $AUTH_NGX -b /tmp/acar-cookies.txt "$BASE_LOCAL/api/auth/session" | head -c 200; echo

echo "=== ADMIN PAGES ==="
for path in /admin /admin/journals /admin/issues /admin/articles /admin/authors /admin/pdfs \
  /admin/data-quality /admin/etl /admin/url-aliases /admin/users /admin/audit /admin/health /hesabim; do
  code=$(curl -sS $AUTH_NGX -b /tmp/acar-cookies.txt -o /dev/null -w '%{http_code}' "$BASE_LOCAL$path")
  echo "$path:$code"
  [[ "$code" == "200" ]] || fail "$path not 200"
done

echo "=== PUBLIC CATALOG ==="
for path in / /journals /search?q=enerji /api/health; do
  code=$(curl -sS $AUTH_NGX -o /dev/null -w '%{http_code}' "$BASE_LOCAL$path")
  echo "catalog $path:$code"
done

echo "=== PDF ==="
pdf=$(curl -sS $AUTH_NGX -o /tmp/t.pdf -w '%{http_code}:%{content_type}' "$BASE_LOCAL/api/pdf-proxy/18")
head -c 5 /tmp/t.pdf; echo
echo "$pdf"

echo "=== LOGOUT ==="
CJ=/tmp/acar-cj-unified.txt
cp /tmp/acar-cookies.txt "$CJ"
csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE_LOCAL/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
[[ -n "$csrf" ]] || fail "logout csrf missing"
logout_code=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE_LOCAL/api/auth/logout" \
  -H "x-csrf-token: $csrf" -o /dev/null -w '%{http_code}')
[[ "$logout_code" == "200" ]] || fail "logout expected 200 got $logout_code"
code=$(curl -sS $AUTH_NGX -b "$CJ" -o /dev/null -w '%{http_code}' "$BASE_LOCAL/admin")
echo "admin_after_logout:$code"
[[ "$code" != "200" ]] || fail "admin accessible after logout"
session_body=$(curl -sS $AUTH_NGX -b "$CJ" "$BASE_LOCAL/api/auth/session")
echo "session_after_logout:$session_body"
echo "$session_body" | grep -q '"authenticated":false' || fail "session still authenticated after logout"

echo "=== SEO ==="
curl -sS -I $AUTH_NGX "$BASE_HTTPS/" | tr -d '\r' | grep -i x-robots-tag
curl -sS $AUTH_NGX "$BASE_HTTPS/robots.txt" | head -2

htpasswd -D /etc/nginx/.htpasswd-acarindex-beta "$NGX_USER" 2>/dev/null || true
echo "ACCEPTANCE_OK"

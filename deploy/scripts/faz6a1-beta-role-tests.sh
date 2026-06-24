#!/usr/bin/env bash
# Role matrix HTTP checks on pilot stack (cookie jar aware)
set -euo pipefail
BASE="http://127.0.0.1:3002"
MAP=/root/.faz6a-test-passmap

fail() { echo "FAIL: $1"; exit 1; }

login_session() {
  local email="$1" pass="$2" jar="$3"
  rm -f "$jar"
  local csrf
  csrf=$(curl -sS -c "$jar" -b "$jar" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
  [[ -n "$csrf" ]] || fail "csrf for $email"
  curl -sS -c "$jar" -b "$jar" -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
    -d "{\"email\":\"$email\",\"password\":\"$pass\"}" -o /dev/null -w '%{http_code}\n' | tail -1
}

get_code() {
  local jar="$1" path="$2"
  curl -sS -b "$jar" -o /dev/null -w '%{http_code}' "$BASE$path"
}

echo "=== USER should not access admin ==="
email=$(grep '^USER=' /root/.faz6a-test-users | cut -d= -f2)
pass=$(grep "^${email}=" "$MAP" | cut -d= -f2)
jar=/tmp/role-user.txt
login_session "$email" "$pass" "$jar"
code=$(get_code "$jar" /admin)
echo "USER /admin: $code"
[[ "$code" != "200" ]] || fail "USER reached admin"

echo "=== EDITOR admin ==="
email=$(grep '^EDITOR=' /root/.faz6a-test-users | cut -d= -f2)
pass=$(grep "^${email}=" "$MAP" | cut -d= -f2)
jar=/tmp/role-editor.txt
login_session "$email" "$pass" "$jar"
code=$(get_code "$jar" /admin)
echo "EDITOR /admin: $code"
[[ "$code" == "200" ]] || fail "EDITOR admin $code"
code=$(get_code "$jar" /admin/users)
echo "EDITOR /admin/users: $code (expect not 200)"
[[ "$code" != "200" ]] || fail "EDITOR reached users"

echo "=== MODERATOR data-quality ==="
email=$(grep '^MODERATOR=' /root/.faz6a-test-users | cut -d= -f2)
pass=$(grep "^${email}=" "$MAP" | cut -d= -f2)
jar=/tmp/role-mod.txt
login_session "$email" "$pass" "$jar"
code=$(get_code "$jar" /admin/data-quality)
echo "MODERATOR data-quality: $code"
[[ "$code" == "200" ]] || fail "MODERATOR data-quality $code"

echo "=== ADMIN users page ==="
email=$(grep '^ADMIN=' /root/.faz6a-test-users | cut -d= -f2)
pass=$(grep "^${email}=" "$MAP" | cut -d= -f2)
jar=/tmp/role-adm.txt
login_session "$email" "$pass" "$jar"
code=$(get_code "$jar" /admin/users)
echo "ADMIN users: $code"
[[ "$code" == "200" ]] || fail "ADMIN users $code"

echo "=== ADMIN cannot assign SUPER_ADMIN (API) ==="
csrf=$(curl -sS -c "$jar" -b "$jar" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
target=$(grep '^USER=' /root/.faz6a-test-users | cut -d= -f2)
uid=$(docker compose --env-file /etc/acarindex/pilot.env -f /opt/acarindex/docker-compose.pilot.yml exec -T postgres \
  psql -U acarindex_pilot -d acarindex_pilot -tAc "SELECT id FROM users WHERE email='$target'")
api_code=$(curl -sS -b "$jar" -c "$jar" -X POST "$BASE/api/admin/users/$uid/roles" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d '{"roleId":"SUPER_ADMIN"}' -o /dev/null -w '%{http_code}')
echo "ADMIN assign SUPER_ADMIN: $api_code (expect 400)"
[[ "$api_code" == "400" ]] || fail "ADMIN assigned SUPER_ADMIN?"

echo "=== SUPER_ADMIN all modules sample ==="
CRED=/root/.faz6a-admin-credentials
EMAIL=$(grep '^email=' "$CRED" | cut -d= -f2- | tr -d '\r')
PASS=$(grep '^pass=' "$CRED" | cut -d= -f2- | tr -d '\r')
jar=/tmp/role-super.txt
login_session "$EMAIL" "$PASS" "$jar"
for path in /admin /admin/users /admin/audit /admin/health; do
  code=$(get_code "$jar" "$path")
  echo "SUPER $path: $code"
  [[ "$code" == "200" ]] || fail "SUPER $path $code"
done

echo "ROLE_TESTS_OK"

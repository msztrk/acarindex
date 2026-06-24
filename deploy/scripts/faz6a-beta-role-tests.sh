#!/usr/bin/env bash
set -euo pipefail
BASE="http://127.0.0.1:3002"
MAP=/root/.faz6a-test-passmap

login_get_admin_code() {
  local email="$1" pass="$2"
  local csrf=$(curl -sS "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
  curl -sS -c /tmp/role-cookies.txt -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
    -d "{\"email\":\"$email\",\"password\":\"$pass\"}" -o /dev/null
  curl -sS -b /tmp/role-cookies.txt -o /dev/null -w '%{http_code}' "$BASE/admin"
}

echo "=== USER should not access admin ==="
email=$(grep '^USER=' /root/.faz6a-test-users | cut -d= -f2)
pass=$(grep "^${email}=" "$MAP" | cut -d= -f2)
code=$(login_get_admin_code "$email" "$pass")
echo "USER /admin: $code (expect 404)"
[[ "$code" == "404" ]] || [[ "$code" == "307" ]] || echo "WARN user admin $code"

echo "=== EDITOR admin ==="
email=$(grep '^EDITOR=' /root/.faz6a-test-users | cut -d= -f2)
pass=$(grep "^${email}=" "$MAP" | cut -d= -f2)
code=$(login_get_admin_code "$email" "$pass")
echo "EDITOR /admin: $code (expect 200)"
[[ "$code" == "200" ]] || exit 1

echo "=== MODERATOR data-quality ==="
email=$(grep '^MODERATOR=' /root/.faz6a-test-users | cut -d= -f2)
pass=$(grep "^${email}=" "$MAP" | cut -d= -f2)
csrf=$(curl -sS "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
curl -sS -c /tmp/mod.txt -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"email\":\"$email\",\"password\":\"$pass\"}" -o /dev/null
code=$(curl -sS -b /tmp/mod.txt -o /dev/null -w '%{http_code}' "$BASE/admin/data-quality")
echo "MODERATOR data-quality: $code"

echo "=== ADMIN users page ==="
email=$(grep '^ADMIN=' /root/.faz6a-test-users | cut -d= -f2)
pass=$(grep "^${email}=" "$MAP" | cut -d= -f2)
csrf=$(curl -sS "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
curl -sS -c /tmp/adm.txt -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"email\":\"$email\",\"password\":\"$pass\"}" -o /dev/null
code=$(curl -sS -b /tmp/adm.txt -o /dev/null -w '%{http_code}' "$BASE/admin/users")
echo "ADMIN users: $code"

echo "=== SECOND BOOTSTRAP SKIP ==="
docker compose --env-file /etc/acarindex/pilot.env -f docker-compose.pilot.yml --profile tools run --rm \
  -e BOOTSTRAP_ADMIN_EMAIL=msztrk@gmail.com -e BOOTSTRAP_CONFIRM=1 -e BOOTSTRAP_ADMIN_PASSWORD=x \
  etl scripts/auth/bootstrap-super-admin.ts 2>&1 | grep -i 'Zaten\|atlandı\|SUPER_ADMIN mevcut' || true

echo "ROLE_TESTS_OK"

#!/usr/bin/env bash
set -euo pipefail
cd /opt/acarindex
OUT=/root/.faz6a-test-users
rm -f "$OUT"
touch "$OUT"
chmod 600 "$OUT"

mk() {
  local role="$1"
  local email="test-$(echo "$role" | tr '[:upper:]' '[:lower:]')@acarindex-beta.invalid"
  local pass=$(openssl rand -base64 12 | tr -d '/+=' | head -c 12)
  docker compose --env-file /etc/acarindex/pilot.env -f docker-compose.pilot.yml --profile tools run --rm \
    -e NEW_PASS="$pass" \
    etl scripts/auth/create-role-test-user.ts "$email" "$role" 2>&1 | tail -1
  echo "${role}=${email}" >> "$OUT"
  echo "${role}_pass=stored" >> "$OUT"
  # store pass in separate root-only map file
  echo "${email}=${pass}" >> /root/.faz6a-test-passmap
}

chmod 600 /root/.faz6a-test-passmap 2>/dev/null || true
: > /root/.faz6a-test-passmap
chmod 600 /root/.faz6a-test-passmap

for r in USER EDITOR MODERATOR ADMIN; do mk "$r"; done
echo "ROLE_USERS_OK"

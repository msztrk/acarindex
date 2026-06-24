#!/usr/bin/env bash
set -euo pipefail
PASS=$(openssl rand -base64 18 | tr -d '/+=' | head -c 16)
{
  echo "email=msztrk@gmail.com"
  echo "pass=${PASS}"
} > /root/.faz6a-admin-credentials
chmod 600 /root/.faz6a-admin-credentials

cd /opt/acarindex
docker compose --env-file /etc/acarindex/pilot.env -f docker-compose.pilot.yml --profile tools run --rm \
  -e NEW_PASS="$PASS" \
  etl scripts/auth/set-user-password.ts msztrk@gmail.com

echo "credentials_file_ok"

#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/acarindex

# Use memory storage on beta when B2 creds are not configured (never log secrets).
PILOT_ENV=/etc/acarindex/pilot.env
if [[ -f "$PILOT_ENV" ]]; then
  if ! grep -qE '^B2_APPLICATION_KEY_ID=.+' "$PILOT_ENV" 2>/dev/null; then
    if grep -q '^APPLICATION_STORAGE_PROVIDER=' "$PILOT_ENV" 2>/dev/null; then
      sed -i 's/^APPLICATION_STORAGE_PROVIDER=.*/APPLICATION_STORAGE_PROVIDER=memory/' "$PILOT_ENV"
    else
      echo 'APPLICATION_STORAGE_PROVIDER=memory' >> "$PILOT_ENV"
    fi
    echo "B4: B2 creds absent — APPLICATION_STORAGE_PROVIDER=memory on pilot"
  else
    echo "B4: B2 creds present — using configured APPLICATION_STORAGE_PROVIDER"
  fi
fi

git reset --hard origin/redesign-v2
git pull --ff-only origin redesign-v2
docker compose --env-file /etc/acarindex/pilot.env -f docker-compose.pilot.yml build app
docker compose --env-file /etc/acarindex/pilot.env -f docker-compose.pilot.yml --profile app up -d app
sleep 25
curl -sf http://127.0.0.1:3002/api/health
bash deploy/scripts/beta/faz-a-beta-smoke.sh

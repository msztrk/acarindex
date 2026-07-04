#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/acarindex

git reset --hard origin/redesign-v2
git pull --ff-only origin redesign-v2
docker compose --env-file /etc/acarindex/pilot.env -f docker-compose.pilot.yml build app
docker compose --env-file /etc/acarindex/pilot.env -f docker-compose.pilot.yml --profile app up -d app
sleep 25
curl -sf http://127.0.0.1:3002/api/health
bash deploy/scripts/beta/faz-a-beta-smoke.sh

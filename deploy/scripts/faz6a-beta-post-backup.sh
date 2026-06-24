#!/usr/bin/env bash
set -euo pipefail
COMPOSE="docker compose --env-file /etc/acarindex/pilot.env -f /opt/acarindex/docker-compose.pilot.yml"
TS=$(date +%Y%m%d_%H%M%S)
BACKUP="/var/backups/acarindex-pilot/pilot_pg_post_auth_${TS}.dump"
$COMPOSE exec -T postgres pg_dump -U acarindex_pilot -Fc acarindex_pilot > "$BACKUP"
ls -lh "$BACKUP"
sha256sum "$BACKUP"
echo "BACKUP=$BACKUP"

# Restore-test DB (volume dokunulmaz)
$COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "DROP DATABASE IF EXISTS acarindex_restore_test;"
$COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "CREATE DATABASE acarindex_restore_test;"
$COMPOSE exec -T postgres pg_restore -U acarindex_pilot -d acarindex_restore_test "$BACKUP" 2>&1 | tail -3
$COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_restore_test -c "SELECT count(*) AS articles FROM articles; SELECT count(*) AS users FROM users;"
echo "RESTORE_TEST_OK"

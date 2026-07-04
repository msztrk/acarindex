#!/usr/bin/env bash
# Faz 6A.1 pilot PostgreSQL backup with counts and SHA-256
set -euo pipefail

LABEL="${1:-faz6a1}"
COMPOSE="docker compose --env-file /etc/acarindex/pilot.env -f /opt/acarindex/docker-compose.pilot.yml"
TS=$(date +%Y%m%d_%H%M%S)
BACKUP="/var/backups/acarindex-pilot/pilot_pg_${LABEL}_${TS}.dump"
COUNTS_FILE="/var/backups/acarindex-pilot/${LABEL}_counts_${TS}.txt"

mkdir -p /var/backups/acarindex-pilot

echo "=== CATALOG + AUTH COUNTS ($LABEL) ==="
$COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT 'journals' AS t, count(*) FROM journals;
   SELECT 'issues', count(*) FROM issues;
   SELECT 'articles', count(*) FROM articles;
   SELECT 'authors', count(*) FROM authors;
   SELECT 'users', count(*) FROM users;
   SELECT 'sessions', count(*) FROM sessions;
   SELECT 'audit_logs', count(*) FROM audit_logs;" | tee "$COUNTS_FILE"

echo "=== BACKUP ==="
$COMPOSE exec -T postgres pg_dump -U acarindex_pilot -Fc acarindex_pilot > "$BACKUP"
size=$(stat -c%s "$BACKUP" 2>/dev/null || stat -f%z "$BACKUP")
[[ "$size" -gt 0 ]] || { echo "empty backup"; exit 1; }
ls -lh "$BACKUP"
sha256sum "$BACKUP"
echo "BACKUP=$BACKUP"
echo "COUNTS=$COUNTS_FILE"

echo "=== BACKUP VERIFY ==="
$COMPOSE exec -T postgres pg_restore --list < "$BACKUP" >/dev/null || { echo "FAIL: pg_restore --list"; exit 1; }
BACKUP_SHA=$(sha256sum "$BACKUP" | awk '{print $1}')
echo "BACKUP_SHA256=$BACKUP_SHA"
echo "PG_RESTORE_LIST_OK"

UPLOAD_SCRIPT="$(dirname "$0")/beta/upload-pilot-backup-to-b2.sh"
if [[ -x "$UPLOAD_SCRIPT" ]]; then
  bash "$UPLOAD_SCRIPT" "$BACKUP" "$BACKUP_SHA" || echo "WARN: B2 upload skipped or failed"
fi

if [[ "${PILOT_BACKUP_RETENTION:-1}" == "1" ]]; then
  RETENTION_SCRIPT="$(dirname "$0")/beta/pilot-backup-retention.sh"
  if [[ -x "$RETENTION_SCRIPT" ]]; then
    bash "$RETENTION_SCRIPT" "$BACKUP"
  fi
fi

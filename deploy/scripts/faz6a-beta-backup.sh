#!/usr/bin/env bash
set -euo pipefail

COMPOSE="docker compose --env-file /etc/acarindex/pilot.env -f /opt/acarindex/docker-compose.pilot.yml"
TS=$(date +%Y%m%d_%H%M%S)
BACKUP="/var/backups/acarindex-pilot/pilot_pg_pre_auth_${TS}.dump"
COUNTS_FILE="/var/backups/acarindex-pilot/pre_auth_counts_${TS}.txt"

echo "=== PRE-AUTH CATALOG COUNTS ==="
$COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT 'journals' AS t, count(*) FROM journals;
   SELECT 'issues', count(*) FROM issues;
   SELECT 'articles', count(*) FROM articles;
   SELECT 'authors', count(*) FROM authors;
   SELECT 'article_authors', count(*) FROM article_authors;" | tee "$COUNTS_FILE"

echo "=== BACKUP ==="
$COMPOSE exec -T postgres pg_dump -U acarindex_pilot -Fc acarindex_pilot > "$BACKUP"
ls -lh "$BACKUP"
sha256sum "$BACKUP"
echo "BACKUP=$BACKUP"

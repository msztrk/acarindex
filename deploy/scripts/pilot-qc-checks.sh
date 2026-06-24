#!/usr/bin/env bash
set -euo pipefail

COMPOSE="docker compose --env-file /etc/acarindex/pilot.env -f /opt/acarindex/docker-compose.pilot.yml"

echo "=== health ==="
curl -s -o /dev/null -w "health:%{http_code}\n" http://127.0.0.1:3002/api/health

echo "=== duplicate slugs ==="
$COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT slug, count(*) AS n FROM articles GROUP BY slug HAVING count(*) > 1;"

echo "=== orphan articles ==="
$COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT count(*) AS orphan_articles FROM articles a WHERE NOT EXISTS (SELECT 1 FROM issues i WHERE i.id = a.issue_id);"

echo "=== etl_runs ==="
$COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT id, status, mode FROM etl_runs ORDER BY id;"

echo "=== url_aliases count ==="
$COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT count(*) AS url_aliases FROM url_aliases;"

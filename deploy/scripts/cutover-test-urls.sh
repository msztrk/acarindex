#!/usr/bin/env bash
set -euo pipefail

COMPOSE="docker compose --env-file /etc/acarindex/pilot.env -f /opt/acarindex/docker-compose.pilot.yml"

echo "=== JOURNALS ==="
$COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -t -A -c \
  "SELECT slug FROM journals ORDER BY id LIMIT 3;"

echo "=== ISSUES ==="
$COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -t -A -c \
  "SELECT j.slug || '/sayi-' || i.issue_number FROM issues i JOIN journals j ON j.id = i.journal_id ORDER BY i.id LIMIT 3;"

echo "=== ARTICLES ==="
$COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -t -A -c \
  "SELECT j.slug || '/' || a.slug || '-' || a.id FROM articles a JOIN issues i ON i.id = a.issue_id JOIN journals j ON j.id = i.journal_id ORDER BY a.id LIMIT 10;"

echo "=== AUTHORS ==="
$COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -t -A -c \
  "SELECT slug || '-' || id FROM authors ORDER BY id LIMIT 3;"

echo "=== PDF ARTICLES ==="
$COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -t -A -c \
  "SELECT a.id FROM articles a JOIN pdf_files p ON p.article_id = a.id WHERE p.file_status != 'missing' ORDER BY a.id LIMIT 5;"

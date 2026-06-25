#!/usr/bin/env bash
# Faz 6B beta pilot — user panel migration + app rebuild (pilot PG only)
set -Eeuo pipefail

ROOT="${ACAR_ROOT:-/opt/acarindex}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

BASE_LOCAL="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"
LOG="/var/log/acarindex-faz6b-beta-deploy.log"

acar_beta_require_pilot

exec > >(tee -a "$LOG") 2>&1

echo "=== FAZ6B BETA DEPLOY $(date -Is) ==="
cd "$ROOT"

count_catalog() {
  $ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
    "SELECT 'journals' AS t, count(*)::bigint AS n FROM journals;
     SELECT 'issues', count(*)::bigint FROM issues;
     SELECT 'articles', count(*)::bigint FROM articles;
     SELECT 'pdf_files', count(*)::bigint FROM pdf_files;
     SELECT 'authors', count(*)::bigint FROM authors;
     SELECT 'article_authors', count(*)::bigint FROM article_authors;"
}

echo "=== PRE COUNTS ==="
count_catalog
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT 'users', count(*)::bigint FROM users;
   SELECT 'sessions', count(*)::bigint FROM sessions;
   SELECT 'audit_logs', count(*)::bigint FROM audit_logs;"

echo "=== DB TARGET ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc "SELECT current_database();"
$ACAR_COMPOSE ps --format '{{.Names}}' postgres

echo "=== PRE BACKUP ==="
bash "$ROOT/deploy/scripts/faz6a1-beta-backup.sh" pre_user_panel

echo "=== BUILD MIGRATE IMAGE ==="
$ACAR_COMPOSE build migrate

echo "=== MIGRATE DEPLOY (1) ==="
$ACAR_COMPOSE --profile tools run --rm migrate

echo "=== MIGRATE DEPLOY (2 no-op) ==="
$ACAR_COMPOSE --profile tools run --rm migrate

echo "=== USER PANEL TABLES ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN (
    'saved_articles','reading_lists','reading_list_items','followed_journals',
    'followed_authors','notification_preferences','recent_views') ORDER BY 1;"

echo "=== CONSTRAINTS SAMPLE ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT conname FROM pg_constraint WHERE conname LIKE '%saved_articles%' OR conname LIKE '%reading_list%' OR conname LIKE '%followed%' OR conname LIKE '%recent_views%' ORDER BY 1 LIMIT 20;"

echo "=== POST-MIGRATION COUNTS ==="
count_catalog

echo "=== BUILD APP ==="
$ACAR_COMPOSE build app

echo "=== RESTART APP ONLY ==="
$ACAR_COMPOSE --profile app up -d --no-deps app

sleep 25
curl -sf "$BASE_LOCAL/api/health" && echo

echo "FAZ6B_MIGRATE_AND_REBUILD_OK"

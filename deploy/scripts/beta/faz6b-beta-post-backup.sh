#!/usr/bin/env bash
# Faz 6B beta — post user-panel migration backup + restore-test (pilot volume untouched)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

LABEL="${1:-post_user_panel}"
acar_beta_require_pilot

TS=$(date +%Y%m%d_%H%M%S)
BACKUP="/var/backups/acarindex-pilot/pilot_pg_${LABEL}_${TS}.dump"
mkdir -p /var/backups/acarindex-pilot

$ACAR_COMPOSE exec -T postgres pg_dump -U acarindex_pilot -Fc acarindex_pilot > "$BACKUP"
[[ -s "$BACKUP" ]] || { echo "FAIL: empty backup" >&2; exit 1; }
ls -lh "$BACKUP"
sha256sum "$BACKUP"
echo "BACKUP=$BACKUP"

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT 'journals', count(*)::bigint FROM journals;
   SELECT 'articles', count(*)::bigint FROM articles;
   SELECT 'users', count(*)::bigint FROM users;
   SELECT 'saved_articles', count(*)::bigint FROM saved_articles;
   SELECT 'reading_lists', count(*)::bigint FROM reading_lists;"

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "DROP DATABASE IF EXISTS acarindex_restore_test;"
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "CREATE DATABASE acarindex_restore_test;"
cat "$BACKUP" | $ACAR_COMPOSE exec -T postgres pg_restore -U acarindex_pilot -d acarindex_restore_test 2>&1 | tail -5
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_restore_test -c \
  "SELECT count(*) AS articles FROM articles;
   SELECT count(*) AS users FROM users;
   SELECT to_regclass('public.saved_articles') AS saved_articles_tbl;
   SELECT to_regclass('public.reading_lists') AS reading_lists_tbl;"
echo "RESTORE_TEST_OK"

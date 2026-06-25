#!/usr/bin/env bash
# Restore-test helper — reads backup from host path, never touches pilot volume.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

BACKUP="${1:-}"
if [[ -z "$BACKUP" || ! -f "$BACKUP" ]]; then
  echo "usage: $0 /var/backups/acarindex-pilot/pilot_pg_*.dump" >&2
  exit 1
fi

acar_beta_require_pilot

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "DROP DATABASE IF EXISTS acarindex_restore_test;"
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "CREATE DATABASE acarindex_restore_test;"
cat "$BACKUP" | $ACAR_COMPOSE exec -T postgres pg_restore -U acarindex_pilot -d acarindex_restore_test 2>&1 | tail -5
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_restore_test -c \
  "SELECT count(*) AS articles FROM articles;
   SELECT count(*) AS users FROM users;
   SELECT to_regclass('public.saved_articles') AS saved_articles_tbl;
   SELECT to_regclass('public.reading_lists') AS reading_lists_tbl;"
echo "RESTORE_TEST_OK"

#!/usr/bin/env bash
# Faz 6B.2 — revert smoke-test catalog mutations and remove identifiable smoke rows.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

SMOKE_AUTHOR_ID="${ACAR_SMOKE_AUTHOR_ID:-542}"

acar_beta_require_pilot

echo "=== REVERT AUTHOR $SMOKE_AUTHOR_ID is_provisional ==="
before=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT is_provisional FROM authors WHERE id = $SMOKE_AUTHOR_ID;")
echo "author_${SMOKE_AUTHOR_ID}_before_provisional=$before"

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "UPDATE authors SET is_provisional = true WHERE id = $SMOKE_AUTHOR_ID;"

after=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT is_provisional FROM authors WHERE id = $SMOKE_AUTHOR_ID;")
echo "author_${SMOKE_AUTHOR_ID}_after_provisional=$after"
[[ "$after" == "t" ]] || { echo "FAIL: author revert" >&2; exit 1; }

follow_count=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM followed_authors WHERE author_id = $SMOKE_AUTHOR_ID;")
echo "followed_authors_author_${SMOKE_AUTHOR_ID}=$follow_count"
[[ "$follow_count" == "0" ]] || { echo "FAIL: unexpected follow row" >&2; exit 1; }

echo "=== SMOKE-LABELED READING LISTS ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT id, name, user_id FROM reading_lists WHERE name LIKE 'Faz6B%';"
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "DELETE FROM reading_lists WHERE name LIKE 'Faz6B%';"

echo "=== USER-PANEL ROW COUNTS ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT 'saved_articles', count(*)::bigint FROM saved_articles;
   SELECT 'reading_lists', count(*)::bigint FROM reading_lists;
   SELECT 'reading_list_items', count(*)::bigint FROM reading_list_items;
   SELECT 'followed_journals', count(*)::bigint FROM followed_journals;
   SELECT 'followed_authors', count(*)::bigint FROM followed_authors;
   SELECT 'recent_views', count(*)::bigint FROM recent_views;
   SELECT 'notification_preferences', count(*)::bigint FROM notification_preferences;"

echo "CLEANUP_SMOKE_ARTIFACTS_OK"

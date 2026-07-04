#!/usr/bin/env bash
# Pre-Faz-B — isolated journal ID sequence rollback rehearsal (NOT on pilot DB)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

BACKUP="${1:-}"
REHEARSAL_DB="${ACAR_JOURNAL_ID_REHEARSAL_DB:-acarindex_journal_id_rehearsal}"
MIGRATION_SQL="$ACAR_ROOT/prisma/migrations/20260711100000_journal_id_sequence/migration.sql"
ROLLBACK_SQL="$ACAR_ROOT/prisma/migrations/20260711100000_journal_id_sequence/rollback.sql"

acar_beta_require_pilot

if [[ -z "$BACKUP" ]]; then
  BACKUP=$(ls -t /var/backups/acarindex-pilot/pilot_pg_pre_faz_b_journal_id_*.dump 2>/dev/null | head -1)
fi
[[ -n "$BACKUP" && -f "$BACKUP" ]] || { echo "FAIL: backup not found"; exit 1; }

echo "=== JOURNAL ID ROLLBACK REHEARSAL $(date -Is) ==="
echo "BACKUP=$BACKUP"
echo "REHEARSAL_DB=$REHEARSAL_DB"

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$REHEARSAL_DB' AND pid <> pg_backend_pid();" 2>/dev/null || true
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "DROP DATABASE IF EXISTS \"$REHEARSAL_DB\" WITH (FORCE);"
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "CREATE DATABASE \"$REHEARSAL_DB\";"

echo "=== RESTORE PRE-MIGRATION BACKUP ==="
$ACAR_COMPOSE exec -T postgres pg_restore -U acarindex_pilot -d "$REHEARSAL_DB" --no-owner --no-acl < "$BACKUP"

sample_ids() {
  $ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -tAc \
    "SELECT string_agg(id::text, ',' ORDER BY id) FROM (SELECT id FROM journals ORDER BY id LIMIT 5) s;" | tr -d ' \r\n'
}

PRE_IDS=$(sample_ids)
PRE_MAX=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -tAc "SELECT MAX(id) FROM journals;" | tr -d ' \r\n')
echo "PRE_SAMPLE_IDS=$PRE_IDS PRE_MAX=$PRE_MAX"

echo "=== APPLY JOURNAL ID MIGRATION ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -f - < "$MIGRATION_SQL"

echo "=== TEST INSERTS ==="
AUTO_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -tAc \
  "INSERT INTO journals (slug, status) VALUES ('journal-id-rehearsal-auto', 'draft') RETURNING id;" | tr -d ' \r\n')
LEGACY_ID=$((PRE_MAX + 600000))
EXPLICIT_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -tAc \
  "INSERT INTO journals (id, slug, status) VALUES ($LEGACY_ID, 'journal-id-rehearsal-legacy', 'draft') RETURNING id;" | tr -d ' \r\n')
echo "AUTO_ID=$AUTO_ID EXPLICIT_ID=$EXPLICIT_ID"

echo "=== ROLLBACK ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -f - < "$ROLLBACK_SQL"

POST_IDS=$(sample_ids)
POST_MAX=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -tAc "SELECT MAX(id) FROM journals;" | tr -d ' \r\n')
echo "POST_SAMPLE_IDS=$POST_IDS POST_MAX=$POST_MAX"
[[ "$PRE_IDS" == "$POST_IDS" ]] || { echo "FAIL: sample journal ids changed after rollback"; exit 1; }
[[ "$PRE_MAX" == "$POST_MAX" ]] || { echo "FAIL: max journal id changed after rollback"; exit 1; }

REMAINING=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -tAc \
  "SELECT count(*) FROM journals WHERE slug LIKE 'journal-id-rehearsal-%';" | tr -d ' \r\n')
[[ "$REMAINING" == "2" ]] && echo "ROLLBACK_KEPT_TEST_ROWS_OK" || echo "NOTE: rehearsal rows remain count=$REMAINING (ids preserved)"

echo "=== RE-APPLY MIGRATION ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -f - < "$MIGRATION_SQL"

REINSERT=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -tAc \
  "INSERT INTO journals (slug, status) VALUES ('journal-id-rehearsal-reapply', 'draft') RETURNING id;" | tr -d ' \r\n')
[[ -n "$REINSERT" ]] && echo "REAPPLY_INSERT_OK id=$REINSERT" || { echo "FAIL: insert without id after reapply"; exit 1; }

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "DROP DATABASE IF EXISTS \"$REHEARSAL_DB\" WITH (FORCE);"
echo "JOURNAL_ID_ROLLBACK_REHEARSAL_OK"

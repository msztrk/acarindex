#!/usr/bin/env bash
# Faz B2 — isolated rollback rehearsal (NOT on pilot DB)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

BACKUP="${1:-}"
REHEARSAL_DB="${ACAR_FAZ_B2_REHEARSAL_DB:-acarindex_faz_b2_rehearsal}"

acar_beta_require_pilot

ROLLBACK_SQL="$ACAR_ROOT/prisma/migrations/20260713100000_journal_application_faz_b2/rollback.sql"
MIGRATION_SQL="$ACAR_ROOT/prisma/migrations/20260713100000_journal_application_faz_b2/migration.sql"

if [[ -z "$BACKUP" ]]; then
  BACKUP=$(ls -t /var/backups/acarindex-pilot/pilot_pg_pre_journal_application_faz_b2_*.dump 2>/dev/null | head -1)
fi
[[ -n "$BACKUP" && -f "$BACKUP" ]] || { echo "FAIL: backup not found"; exit 1; }

echo "=== FAZ B2 ROLLBACK REHEARSAL $(date -Is) ==="
echo "BACKUP=$BACKUP REHEARSAL_DB=$REHEARSAL_DB"

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$REHEARSAL_DB' AND pid <> pg_backend_pid();" 2>/dev/null || true
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "DROP DATABASE IF EXISTS \"$REHEARSAL_DB\" WITH (FORCE);"
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "CREATE DATABASE \"$REHEARSAL_DB\";"

echo "=== RESTORE PRE-B2 SCHEMA (schema-only — disk-safe) ==="
$ACAR_COMPOSE exec -T postgres pg_restore -U acarindex_pilot -d "$REHEARSAL_DB" --no-owner --no-acl --schema-only < "$BACKUP"

PRE_FLAGS=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -qAt -c \
  "SELECT count(*) FROM information_schema.columns WHERE table_name='journal_applications' AND column_name='duplicate_flags';" | head -1 | tr -d '\r\n')
echo "PRE_DUPLICATE_FLAGS_COL=$PRE_FLAGS"
[[ "$PRE_FLAGS" == "0" ]] || { echo "FAIL: duplicate_flags should not exist pre-B2"; exit 1; }

echo "=== APPLY B2 MIGRATION ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -f - < "$MIGRATION_SQL"

POST_FLAGS=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -qAt -c \
  "SELECT count(*) FROM information_schema.columns WHERE table_name='journal_applications' AND column_name='duplicate_flags';" | head -1 | tr -d '\r\n')
POST_REASON=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -qAt -c \
  "SELECT count(*) FROM information_schema.columns WHERE table_name='journal_applications' AND column_name='duplicate_continue_reason';" | head -1 | tr -d '\r\n')
echo "POST_DUPLICATE_FLAGS_COL=$POST_FLAGS POST_CONTINUE_REASON_COL=$POST_REASON"
[[ "$POST_FLAGS" == "1" && "$POST_REASON" == "1" ]] || { echo "FAIL: B2 columns missing after migrate"; exit 1; }

echo "=== ROLLBACK ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -f - < "$ROLLBACK_SQL"

POST_ROLLBACK_FLAGS=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -qAt -c \
  "SELECT count(*) FROM information_schema.columns WHERE table_name='journal_applications' AND column_name='duplicate_flags';" | head -1 | tr -d '\r\n')
[[ "$POST_ROLLBACK_FLAGS" == "0" ]] || { echo "FAIL: duplicate_flags remains after rollback"; exit 1; }

echo "=== RE-APPLY B2 MIGRATION ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -f - < "$MIGRATION_SQL"

REAPPLY=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -qAt -c \
  "SELECT count(*) FROM information_schema.columns WHERE table_name='journal_applications' AND column_name='duplicate_flags';" | head -1 | tr -d '\r\n')
[[ "$REAPPLY" == "1" ]] && echo "REAPPLY_OK" || { echo "FAIL: reapply"; exit 1; }

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "DROP DATABASE IF EXISTS \"$REHEARSAL_DB\" WITH (FORCE);"
echo "FAZ_B2_ROLLBACK_REHEARSAL_OK"

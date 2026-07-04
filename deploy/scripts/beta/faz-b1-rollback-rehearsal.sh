#!/usr/bin/env bash
# Faz B1 — isolated rollback rehearsal (NOT on pilot DB)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

BACKUP="${1:-}"
REHEARSAL_DB="${ACAR_FAZ_B1_REHEARSAL_DB:-acarindex_faz_b1_rehearsal}"

acar_beta_require_pilot

ROLLBACK_SQL="$ACAR_ROOT/prisma/migrations/20260712100000_journal_application_faz_b1/rollback.sql"
MIGRATION_SQL="$ACAR_ROOT/prisma/migrations/20260712100000_journal_application_faz_b1/migration.sql"

if [[ -z "$BACKUP" ]]; then
  BACKUP=$(ls -t /var/backups/acarindex-pilot/pilot_pg_pre_journal_application_faz_b1_*.dump 2>/dev/null | head -1)
fi
[[ -n "$BACKUP" && -f "$BACKUP" ]] || { echo "FAIL: backup not found"; exit 1; }

echo "=== FAZ B1 ROLLBACK REHEARSAL $(date -Is) ==="
echo "BACKUP=$BACKUP REHEARSAL_DB=$REHEARSAL_DB"

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$REHEARSAL_DB' AND pid <> pg_backend_pid();" 2>/dev/null || true
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "DROP DATABASE IF EXISTS \"$REHEARSAL_DB\" WITH (FORCE);"
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "CREATE DATABASE \"$REHEARSAL_DB\";"

echo "=== RESTORE PRE-B1 BACKUP ==="
$ACAR_COMPOSE exec -T postgres pg_restore -U acarindex_pilot -d "$REHEARSAL_DB" --no-owner --no-acl < "$BACKUP"

PRE_CONTENT=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -qAt -c \
  "SELECT count(*) FROM content_applications;" | head -1 | tr -d '\r\n')
PRE_JA=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -qAt -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='journal_applications';" | head -1 | tr -d '\r\n')
echo "PRE_CONTENT=$PRE_CONTENT PRE_JA_TABLE=$PRE_JA"
[[ "$PRE_JA" == "0" ]] || { echo "FAIL: journal_applications should not exist pre-B1"; exit 1; }

echo "=== APPLY B1 MIGRATION ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -f - < "$MIGRATION_SQL"

echo "=== SEED SAMPLE ROW ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -c \
  "INSERT INTO content_applications (kind, user_id, title, status)
   SELECT 'new_journal', id, 'B1 Rehearsal', 'draft' FROM users LIMIT 1
   RETURNING id;" | tee /tmp/faz_b1_rehearsal_content_id.txt

CONTENT_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -qAt -c \
  "SELECT id FROM content_applications WHERE title='B1 Rehearsal' LIMIT 1;" | head -1 | tr -d '\r\n')

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -c \
  "INSERT INTO journal_applications (content_application_id, name_tr, keywords)
   VALUES ('$CONTENT_ID', 'Rehearsal Dergi', ARRAY['alpha','beta','gamma']);"

echo "=== ROLLBACK ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -f - < "$ROLLBACK_SQL"

POST_CONTENT=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -qAt -c \
  "SELECT count(*) FROM content_applications;" | head -1 | tr -d '\r\n')
POST_JA=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -qAt -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='journal_applications';" | head -1 | tr -d '\r\n')
APPROVED_COL=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -qAt -c \
  "SELECT count(*) FROM information_schema.columns WHERE table_name='content_applications' AND column_name='approved_journal_id';" | head -1 | tr -d '\r\n')

echo "POST_CONTENT=$POST_CONTENT POST_JA_TABLE=$POST_JA APPROVED_COL=$APPROVED_COL"
[[ "$PRE_CONTENT" == "$POST_CONTENT" ]] || { echo "FAIL: content_applications count changed"; exit 1; }
[[ "$POST_JA" == "0" ]] || { echo "FAIL: journal_applications still exists"; exit 1; }
[[ "$APPROVED_COL" == "0" ]] || { echo "FAIL: approved_journal_id column remains"; exit 1; }

echo "=== RE-APPLY B1 MIGRATION ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -f - < "$MIGRATION_SQL"

REAPPLY=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -qAt -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='journal_applications';" | head -1 | tr -d '\r\n')
[[ "$REAPPLY" == "1" ]] && echo "REAPPLY_OK" || { echo "FAIL: reapply"; exit 1; }

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "DROP DATABASE IF EXISTS \"$REHEARSAL_DB\" WITH (FORCE);"
echo "FAZ_B1_ROLLBACK_REHEARSAL_OK"

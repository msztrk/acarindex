#!/usr/bin/env bash
# Faz A — isolated rollback rehearsal (NOT on production pilot DB)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

BACKUP="${1:-}"
REHEARSAL_DB="${ACAR_FAZ_A_REHEARSAL_DB:-acarindex_faz_a_rehearsal}"
ROLLBACK_SQL="$ACAR_ROOT/prisma/migrations/20260710100000_application_center_faz_a/rollback.sql"
MIGRATION_SQL="$ACAR_ROOT/prisma/migrations/20260710100000_application_center_faz_a/migration.sql"

acar_beta_require_pilot

if [[ -z "$BACKUP" ]]; then
  BACKUP=$(ls -t /var/backups/acarindex-pilot/pilot_pg_pre_application_center_faz_a_*.dump 2>/dev/null | head -1)
fi
[[ -n "$BACKUP" && -f "$BACKUP" ]] || { echo "FAIL: backup not found"; exit 1; }

echo "=== FAZ A ROLLBACK REHEARSAL $(date -Is) ==="
echo "BACKUP=$BACKUP"
echo "REHEARSAL_DB=$REHEARSAL_DB"

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$REHEARSAL_DB' AND pid <> pg_backend_pid();" 2>/dev/null || true
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "DROP DATABASE IF EXISTS \"$REHEARSAL_DB\" WITH (FORCE);"
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "CREATE DATABASE \"$REHEARSAL_DB\";"

echo "=== RESTORE PRE-MIGRATION BACKUP ==="
$ACAR_COMPOSE exec -T postgres pg_restore -U acarindex_pilot -d "$REHEARSAL_DB" --no-owner --no-acl < "$BACKUP"

count_users() {
  $ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -tAc "SELECT count(*) FROM users;" | tr -d ' \r\n'
}

PRE_USERS=$(count_users)
echo "PRE_USERS=$PRE_USERS"

echo "=== APPLY FAZ A MIGRATION ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -f - < "$MIGRATION_SQL"

echo "=== SEED SAMPLE ROWS ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -c \
  "INSERT INTO content_applications (kind, user_id, title, status)
   SELECT 'new_journal', id, 'Rehearsal App', 'draft' FROM users LIMIT 1
   RETURNING id;" | tee /tmp/faz_a_rehearsal_app_id.txt

APP_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -tAc \
  "SELECT id FROM content_applications LIMIT 1;" | tr -d ' \r\n')
USER_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -tAc \
  "SELECT user_id FROM content_applications LIMIT 1;" | tr -d ' \r\n')

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -c \
  "INSERT INTO application_revisions (application_id, revision_number, snapshot_json, created_by, submission_type)
   VALUES ('$APP_ID', 1, '{\"title\":\"Rehearsal\"}'::jsonb, '$USER_ID', 'initial_submit');
   INSERT INTO application_events (application_id, event_type, actor_id, to_status)
   VALUES ('$APP_ID', 'draft_created', '$USER_ID', 'draft');
   INSERT INTO application_private_contacts (application_id, contact_email, work_phone)
   VALUES ('$APP_ID', 'rehearsal@example.com', '+905550000000');"

echo "=== ROLLBACK ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -f - < "$ROLLBACK_SQL"

MISSING=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='content_applications';" | tr -d ' \r\n')
[[ "$MISSING" == "0" ]] && echo "ROLLBACK_TABLES_REMOVED_OK" || { echo "FAIL: content_applications still exists"; exit 1; }

POST_USERS=$(count_users)
echo "POST_USERS=$POST_USERS"
[[ "$PRE_USERS" == "$POST_USERS" ]] && echo "AUTH_PRESERVED_OK" || { echo "FAIL: user count changed"; exit 1; }

echo "=== RE-APPLY MIGRATION ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -f - < "$MIGRATION_SQL"
EXISTS=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSAL_DB" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='content_applications';" | tr -d ' \r\n')
[[ "$EXISTS" == "1" ]] && echo "REAPPLY_OK" || { echo "FAIL: reapply"; exit 1; }

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "DROP DATABASE IF EXISTS \"$REHEARSAL_DB\" WITH (FORCE);"
echo "FAZ_A_ROLLBACK_REHEARSAL_OK"

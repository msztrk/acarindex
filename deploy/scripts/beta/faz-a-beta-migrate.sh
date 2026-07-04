#!/usr/bin/env bash
# Faz A beta — pre-migration backup + migration + counts (pilot PG only)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

LABEL="${1:-pre_application_center_faz_a}"
LOG="/var/log/acarindex-faz-a-beta-migrate.log"

acar_beta_require_pilot

exec > >(tee -a "$LOG") 2>&1

echo "=== FAZ A BETA MIGRATE $(date -Is) ==="
cd "$ACAR_ROOT"

count_auth() {
  $ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
    "SELECT 'users', count(*)::bigint FROM users
     UNION ALL SELECT 'sessions', count(*) FROM sessions
     UNION ALL SELECT 'user_roles', count(*) FROM user_roles
     UNION ALL SELECT 'admin_permissions', count(*) FROM admin_permissions
     UNION ALL SELECT 'membership_applications', count(*) FROM membership_applications
     UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs;"
}

count_app_tables() {
  $ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
    "SELECT CASE WHEN to_regclass('public.content_applications') IS NULL THEN 'content_applications=MISSING' ELSE 'content_applications='||(SELECT count(*) FROM content_applications)::text END;"
}

echo "=== PRE BACKUP ==="
bash "$ACAR_ROOT/deploy/scripts/faz6a1-beta-backup.sh" "$LABEL"

echo "=== PRE COUNTS (auth) ==="
count_auth
echo "=== PRE content_applications ==="
count_app_tables || true

echo "=== MIGRATE START $(date +%s) ==="
MIG_START=$(date +%s)
$ACAR_COMPOSE --profile tools run --rm migrate
MIG_END=$(date +%s)
echo "MIGRATION_SECONDS=$((MIG_END - MIG_START))"

echo "=== POST COUNTS (auth) ==="
count_auth

echo "=== POST application tables ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT 'content_applications' AS t, count(*) FROM content_applications
   UNION ALL SELECT 'application_revisions', count(*) FROM application_revisions
   UNION ALL SELECT 'application_events', count(*) FROM application_events
   UNION ALL SELECT 'application_reviews', count(*) FROM application_reviews
   UNION ALL SELECT 'application_attachments', count(*) FROM application_attachments
   UNION ALL SELECT 'application_private_contacts', count(*) FROM application_private_contacts;"

echo "=== MIGRATION RECORD ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name LIKE '%application_center%' ORDER BY finished_at DESC LIMIT 3;"

echo "=== JOURNAL SEQUENCE ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT MAX(id) AS max_journal_id FROM journals;"
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT last_value, is_called FROM pg_sequences WHERE schemaname='public' AND sequencename LIKE '%journal%' LIMIT 5;" || true

echo "=== review_content_applications grants ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM admin_permissions WHERE permission='review_content_applications';"

echo "FAZ_A_BETA_MIGRATE_OK"

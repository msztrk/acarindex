#!/usr/bin/env bash
# Faz B1 beta — pre-migration backup + journal application foundation migration
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

LABEL="${1:-pre_journal_application_faz_b1}"
LOG="/var/log/acarindex-faz-b1-beta-migrate.log"

acar_beta_require_pilot

exec > >(tee -a "$LOG") 2>&1

echo "=== FAZ B1 BETA MIGRATE $(date -Is) ==="
cd "$ACAR_ROOT"

echo "=== PRE BACKUP ==="
bash "$ACAR_ROOT/deploy/scripts/faz6a1-beta-backup.sh" "$LABEL"

echo "=== PRE STATE ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT CASE WHEN to_regclass('public.journal_applications') IS NULL THEN 'journal_applications=MISSING' ELSE 'journal_applications=0' END;
   SELECT CASE WHEN EXISTS (
     SELECT 1 FROM information_schema.columns
     WHERE table_name='content_applications' AND column_name='approved_journal_id'
   ) THEN 'approved_journal_id=EXISTS' ELSE 'approved_journal_id=MISSING' END;"

echo "=== MIGRATE ==="
$ACAR_COMPOSE --profile tools build migrate
$ACAR_COMPOSE --profile tools run --rm migrate
$ACAR_COMPOSE --profile tools run --rm migrate

echo "=== POST STATE ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT 'journal_applications' AS t, count(*) FROM journal_applications
   UNION ALL SELECT 'journal_application_subject_areas', count(*) FROM journal_application_subject_areas
   UNION ALL SELECT 'application_declaration_acceptances', count(*) FROM application_declaration_acceptances;
   SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name LIKE '%journal_application_faz_b1%';"

echo "FAZ_B1_BETA_MIGRATE_OK"

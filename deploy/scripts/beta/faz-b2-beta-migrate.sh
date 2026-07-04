#!/usr/bin/env bash
# Faz B2 beta — pre-migration backup + journal application submit validation columns
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

LABEL="${1:-pre_journal_application_faz_b2}"
LOG="/var/log/acarindex-faz-b2-beta-migrate.log"

acar_beta_require_pilot

exec > >(tee -a "$LOG") 2>&1

echo "=== FAZ B2 BETA MIGRATE $(date -Is) ==="
cd "$ACAR_ROOT"

echo "=== PRE BACKUP ==="
bash "$ACAR_ROOT/deploy/scripts/faz6a1-beta-backup.sh" "$LABEL"

echo "=== PRE STATE ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT CASE WHEN EXISTS (
     SELECT 1 FROM information_schema.columns
     WHERE table_name='journal_applications' AND column_name='duplicate_flags'
   ) THEN 'duplicate_flags=EXISTS' ELSE 'duplicate_flags=MISSING' END;
   SELECT CASE WHEN EXISTS (
     SELECT 1 FROM information_schema.columns
     WHERE table_name='journal_applications' AND column_name='duplicate_continue_reason'
   ) THEN 'duplicate_continue_reason=EXISTS' ELSE 'duplicate_continue_reason=MISSING' END;"

echo "=== MIGRATE ==="
$ACAR_COMPOSE --profile tools build migrate
$ACAR_COMPOSE --profile tools run --rm migrate
$ACAR_COMPOSE --profile tools run --rm migrate

echo "=== POST STATE ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name='journal_applications'
     AND column_name IN ('duplicate_flags', 'duplicate_continue_reason')
   ORDER BY column_name;
   SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name LIKE '%journal_application_faz_b2%';"

echo "FAZ_B2_BETA_MIGRATE_OK"

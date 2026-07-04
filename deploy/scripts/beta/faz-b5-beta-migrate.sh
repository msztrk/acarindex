#!/usr/bin/env bash
# Faz B5 beta — pre-migration backup + notification outbox migration
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

LABEL="${1:-pre_notification_outbox_faz_b5}"
LOG="/var/log/acarindex-faz-b5-beta-migrate.log"

acar_beta_require_pilot

exec > >(tee -a "$LOG") 2>&1

echo "=== FAZ B5 BETA MIGRATE $(date -Is) ==="
cd "$ACAR_ROOT"

echo "=== PRE BACKUP ==="
bash "$ACAR_ROOT/deploy/scripts/faz6a1-beta-backup.sh" "$LABEL"

echo "=== PRE STATE ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT CASE WHEN to_regclass('public.notification_outbox') IS NULL THEN 'notification_outbox=MISSING' ELSE 'notification_outbox=EXISTS' END;"

echo "=== MIGRATE ==="
$ACAR_COMPOSE --profile tools build migrate
$ACAR_COMPOSE --profile tools run --rm migrate
$ACAR_COMPOSE --profile tools run --rm migrate

echo "=== POST STATE ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT count(*) AS notification_outbox_rows FROM notification_outbox;
   SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name LIKE '%notification_outbox_faz_b5%';"

echo "FAZ_B5_BETA_MIGRATE_OK"

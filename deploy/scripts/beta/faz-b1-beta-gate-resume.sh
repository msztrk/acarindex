#!/usr/bin/env bash
# Resume Faz B1 beta gate after backup (migrate + rehearsal + deploy + smoke)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

LOG="/var/log/acarindex-faz-b1-beta-gate-resume-$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1

acar_beta_require_pilot
cd "$ACAR_ROOT"
HEAD=$(git rev-parse HEAD)
BACKUP=$(ls -t /var/backups/acarindex-pilot/pilot_pg_pre_journal_application_faz_b1_*.dump 2>/dev/null | head -1)

echo "=== FAZ B1 RESUME HEAD=$HEAD BACKUP=$BACKUP ==="

echo "=== MIGRATE ==="
$ACAR_COMPOSE --profile tools build migrate
$ACAR_COMPOSE --profile tools run --rm migrate
$ACAR_COMPOSE --profile tools run --rm migrate

echo "=== POST STATE ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT 'journal_applications' AS t, count(*) FROM journal_applications
   UNION ALL SELECT 'journal_application_subject_areas', count(*) FROM journal_application_subject_areas
   UNION ALL SELECT 'application_declaration_acceptances', count(*) FROM application_declaration_acceptances;
   SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '%journal_application_faz_b1%';"

bash "$SCRIPT_DIR/faz-b1-rollback-rehearsal.sh" "$BACKUP"

echo "=== DEPLOY APP ==="
$ACAR_COMPOSE build app
$ACAR_COMPOSE --profile app up -d app
sleep 25
curl -sf "${ACAR_BETA_BASE:-http://127.0.0.1:3002}/api/health" && echo health_ok

bash "$SCRIPT_DIR/faz-a-beta-smoke.sh"

echo "FAZ_B1_BETA_GATE_RESUME_OK HEAD=$HEAD LOG=$LOG"

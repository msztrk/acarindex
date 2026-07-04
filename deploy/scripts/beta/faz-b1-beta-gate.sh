#!/usr/bin/env bash
# Faz B1 beta gate — backup, migrate, rollback rehearsal, deploy, smoke
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

LOG="/var/log/acarindex-faz-b1-beta-gate-$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1

acar_beta_require_pilot
cd "$ACAR_ROOT"
HEAD=$(git rev-parse HEAD)
echo "=== FAZ B1 BETA GATE $(date -Is) HEAD=$HEAD ==="

bash "$SCRIPT_DIR/faz-b1-beta-migrate.sh" pre_journal_application_faz_b1 | tee /tmp/faz_b1_migrate.log
BACKUP=$(grep '^BACKUP=' /tmp/faz_b1_migrate.log | tail -1 | cut -d= -f2-)

bash "$SCRIPT_DIR/faz-b1-rollback-rehearsal.sh" "$BACKUP"

echo "=== DEPLOY APP ==="
$ACAR_COMPOSE build app
$ACAR_COMPOSE --profile app up -d app
sleep 25
curl -sf "${ACAR_BETA_BASE:-http://127.0.0.1:3002}/api/health" && echo health_ok

echo "=== FAZ A SMOKE (regression) ==="
bash "$SCRIPT_DIR/faz-a-beta-smoke.sh"

echo "FAZ_B1_BETA_GATE_OK HEAD=$HEAD LOG=$LOG"

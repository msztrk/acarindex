#!/usr/bin/env bash
# Resume pre-Faz-B gate from step 5 (migration already applied)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

LOG="/var/log/acarindex-pre-faz-b-gate-resume-$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1

acar_beta_require_pilot
cd "$ACAR_ROOT"
HEAD=$(git rev-parse HEAD)
BACKUP=$(ls -t /var/backups/acarindex-pilot/pilot_pg_pre_faz_b_journal_id_*.dump 2>/dev/null | head -1)
echo "HEAD=$HEAD BACKUP=$BACKUP"

echo "=== STEP 5 INTEGRATION TESTS ==="
$ACAR_COMPOSE --profile tools build etl
$ACAR_COMPOSE --profile tools run --rm \
  --entrypoint sh \
  -e JOURNAL_ID_SEQUENCE_INTEGRATION=1 \
  etl -c "npm run test -- tests/journal-id-sequence.test.ts"

echo "=== STEP 6 ROLLBACK REHEARSAL ==="
bash "$SCRIPT_DIR/pre-faz-b-journal-id-rollback-rehearsal.sh" "$BACKUP"

echo "=== STEP 7 DEPLOY APP ==="
$ACAR_COMPOSE build app
$ACAR_COMPOSE --profile app up -d app
sleep 25
curl -sf "${ACAR_BETA_BASE:-http://127.0.0.1:3002}/api/health" && echo health_ok

echo "=== STEP 8 I18N VALIDATE ==="
bash "$SCRIPT_DIR/validate-i18n-beta.sh" | tee /tmp/pre_faz_b_i18n.log

echo "=== STEP 9 SMOKE ==="
bash "$SCRIPT_DIR/faz-a-beta-smoke.sh" | tee /tmp/pre_faz_b_smoke.log

echo "PRE_FAZ_B_GATE_RESUME_OK HEAD=$HEAD LOG=$LOG"

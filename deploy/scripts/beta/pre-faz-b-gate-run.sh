#!/usr/bin/env bash
# Pre-Faz-B preparation gate — beta pilot (steps 3–9)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

LOG="/var/log/acarindex-pre-faz-b-gate-$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1

acar_beta_require_pilot

echo "=== PRE-FAZ-B GATE $(date -Is) ==="
cd "$ACAR_ROOT"
HEAD=$(git rev-parse HEAD)
echo "HEAD=$HEAD"

echo "=== STEP 3 BACKUP ==="
bash "$ACAR_ROOT/deploy/scripts/faz6a1-beta-backup.sh" pre_faz_b_journal_id | tee /tmp/pre_faz_b_backup.log
BACKUP=$(grep '^BACKUP=' /tmp/pre_faz_b_backup.log | tail -1 | cut -d= -f2-)
SHA256=$(sha256sum "$BACKUP" | awk '{print $1}')
SIZE=$(stat -c%s "$BACKUP" 2>/dev/null || stat -f%z "$BACKUP")
echo "BACKUP=$BACKUP SIZE=$SIZE SHA256=$SHA256"

echo "=== PRE MIGRATION JOURNAL STATE ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT count(*) AS journal_rows FROM journals;
   SELECT MAX(id) AS max_journal_id FROM journals;
   SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='journals' AND column_name='id';
   SELECT sequencename, last_value FROM pg_sequences WHERE schemaname='public' AND sequencename LIKE '%journal%';"

echo "=== STEP 4 MIGRATE ==="
$ACAR_COMPOSE --profile tools build migrate
$ACAR_COMPOSE --profile tools run --rm migrate
$ACAR_COMPOSE --profile tools run --rm migrate

echo "=== POST MIGRATION JOURNAL STATE ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='journals' AND column_name='id';
   SELECT last_value, is_called FROM journals_id_seq;
   SELECT MAX(id) AS max_journal_id FROM journals;
   SELECT last_value >= (SELECT MAX(id) FROM journals) AS seq_ahead FROM journals_id_seq;"

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

echo "PRE_FAZ_B_GATE_OK HEAD=$HEAD LOG=$LOG"

#!/usr/bin/env bash
# Pre-Faz-B — journals_id_seq migration verify + integration tests (pilot PG only)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

LOG="/var/log/acarindex-pre-faz-b-journal-id-$(date +%Y%m%d_%H%M%S).log"

acar_beta_require_pilot

exec > >(tee -a "$LOG") 2>&1

echo "=== PRE-FAZ-B JOURNAL ID SEQUENCE $(date -Is) ==="
cd "$ACAR_ROOT"

echo "=== MIGRATE (includes 20260711100000_journal_id_sequence) ==="
$ACAR_COMPOSE --profile tools run --rm migrate

echo "=== SEQUENCE STATE ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT MAX(id) AS max_journal_id FROM journals;"
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT last_value, is_called FROM journals_id_seq;"

echo "=== VERIFY SCRIPT ==="
$ACAR_COMPOSE --profile tools run --rm etl scripts/db/sync-journal-id-sequence.ts

echo "=== INTEGRATION TESTS ==="
$ACAR_COMPOSE --profile tools run --rm \
  -e JOURNAL_ID_SEQUENCE_INTEGRATION=1 \
  etl npm run test -- tests/journal-id-sequence.test.ts

echo "=== ROLLBACK REHEARSAL (sequence only) ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -f - <<'SQL'
BEGIN;
SELECT id FROM journals ORDER BY id LIMIT 3;
ALTER TABLE journals ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS journals_id_seq;
SELECT id FROM journals ORDER BY id LIMIT 3;
ROLLBACK;
SQL

echo "PRE_FAZ_B_JOURNAL_ID_OK log=$LOG"

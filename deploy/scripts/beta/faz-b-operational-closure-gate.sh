#!/usr/bin/env bash
# faz-b-operational-closure-gate.sh — Faz B operasyonel kapanış kontrol kapısı (beta).
# Usage: bash deploy/scripts/beta/faz-b-operational-closure-gate.sh [--skip-b2] [--skip-deploy]
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

LOG="/var/log/acarindex-faz-b-closure-$(date +%Y%m%d_%H%M%S).log"
SKIP_B2=0
SKIP_DEPLOY=0
RESULT_B2=SKIP
RESULT_OUTBOX=FAIL
RESULT_STORAGE=FAIL
RESULT_E2E=FAIL
RESULT_BACKUP_B2=SKIP
RESULT_REGRESSION=FAIL
CLOSURE=HAYIR
FAZ_C=HAYIR

for arg in "$@"; do
  case "$arg" in
    --skip-b2) SKIP_B2=1 ;;
    --skip-deploy) SKIP_DEPLOY=1 ;;
  esac
done

exec > >(tee -a "$LOG") 2>&1

section() { echo ""; echo "========== $* =========="; }

acar_beta_require_pilot
cd "$ACAR_ROOT"

section "1 PRE-CHECK"
echo "LOCAL_HEAD=$(git rev-parse HEAD 2>/dev/null || echo unknown)"
echo "BRANCH=$(git branch --show-current 2>/dev/null || echo unknown)"
echo "BETA_HEAD=$(git rev-parse HEAD)"
curl -sf "${ACAR_BETA_BASE:-http://127.0.0.1:3002}/api/health" && echo "HEALTH=ready" || echo "HEALTH=fail"
df -h / | tail -1
grep '^APPLICATION_STORAGE_PROVIDER=' "$ACAR_PILOT_ENV" | sed 's/=.*/=***/' || true
grep -c '^B2_APPLICATION_KEY_ID=' "$ACAR_PILOT_ENV" 2>/dev/null || echo "B2_APPLICATION_KEYS=0"
crontab -l 2>/dev/null | grep outbox || echo "OUTBOX_CRON=missing"
ls -lh /var/backups/acarindex-pilot/pilot_pg_pre_*.dump 2>/dev/null | tail -5 || true
code=$(curl -sS -o /dev/null -w '%{http_code}' https://beta.acarindex.com/)
echo "BETA_BASIC_AUTH=$code"
robots=$(curl -sSI https://beta.acarindex.com/ 2>/dev/null | tr -d '\r' | grep -i x-robots-tag || true)
echo "BETA_NOINDEX=$robots"
$ACAR_COMPOSE --profile tools run --rm migrate 2>&1 | tail -5

section "2 PRE-WORK BACKUP"
bash "$ACAR_ROOT/deploy/scripts/faz6a1-beta-backup.sh" pre_faz_b_operational_closure | tee /tmp/faz_b_gate_backup.log
BACKUP=$(grep '^BACKUP=' /tmp/faz_b_gate_backup.log | tail -1 | cut -d= -f2-)
SHA=$(grep '^BACKUP_SHA256=' /tmp/faz_b_gate_backup.log | tail -1 | cut -d= -f2-)
[[ -z "$SHA" && -n "$BACKUP" ]] && SHA=$(sha256sum "$BACKUP" | awk '{print $1}')
echo "BACKUP=$BACKUP SHA256=$SHA"
$ACAR_COMPOSE exec -T postgres pg_restore --list < "$BACKUP" 2>&1 | head -10 || true
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT count(*) AS total FROM application_attachments;
   SELECT upload_status, count(*) FROM application_attachments GROUP BY upload_status;
   SELECT count(*) AS orphan FROM application_attachments aa
   WHERE NOT EXISTS (SELECT 1 FROM content_applications ca WHERE ca.id = aa.application_id);"

section "3 B2 APPLICATION STORAGE"
if [[ "$SKIP_B2" == "1" ]]; then
  echo "B2_SKIPPED=by_flag"
  RESULT_B2=SKIP
else
  if grep -qE '^B2_APPLICATION_KEY_ID=.+' "$ACAR_PILOT_ENV" 2>/dev/null; then
    bash "$SCRIPT_DIR/configure-pilot-b2-storage.sh" "$ACAR_PILOT_ENV"
    $ACAR_COMPOSE --profile app up -d app
    sleep 25
    if bash "$SCRIPT_DIR/faz-b2-beta-storage-tests.sh"; then
      RESULT_STORAGE=PASS
      PROVIDER=$(grep '^APPLICATION_STORAGE_PROVIDER=' "$ACAR_PILOT_ENV" | cut -d= -f2- | tr -d '\r')
      [[ "$PROVIDER" == "b2" ]] && RESULT_B2=PASS || RESULT_B2=FAIL
    else
      RESULT_B2=FAIL
      RESULT_STORAGE=FAIL
    fi
  else
    echo "B2_BLOCKED=no_credentials (Backblaze keys absent; browser setup required)"
    RESULT_B2=BLOCKED
    echo "Running storage tests with current provider (memory expected)..."
    bash "$SCRIPT_DIR/faz-b2-beta-storage-tests.sh" && RESULT_STORAGE=PASS || RESULT_STORAGE=FAIL
  fi
fi

section "4 OUTBOX REAL EMAIL"
if [[ ! -f /etc/logrotate.d/acarindex-outbox && -f "$ACAR_ROOT/deploy/logrotate/acarindex-outbox" ]]; then
  cp "$ACAR_ROOT/deploy/logrotate/acarindex-outbox" /etc/logrotate.d/acarindex-outbox
  echo "LOGROTATE_INSTALLED=ok"
fi
bash "$SCRIPT_DIR/faz-b-beta-outbox-email.sh" && RESULT_OUTBOX=PASS || RESULT_OUTBOX=FAIL

section "5-6 E2E JOURNAL FLOW + PUBLISH"
bash "$SCRIPT_DIR/faz-b-beta-e2e-journal-flow.sh" && RESULT_E2E=PASS || RESULT_E2E=FAIL

section "7 PUBLIC JOURNAL STATUS AUDIT"
bash "$SCRIPT_DIR/faz-b-journal-status-audit.sh" || true
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT status, count(*) FROM journals GROUP BY status ORDER BY status;"

section "8 OFF-SITE B2 BACKUP"
if grep -qE '^B2_BACKUP_KEY_ID=.+' "$ACAR_PILOT_ENV" 2>/dev/null; then
  B2_RESTORE_REHEARSE=1 bash "$SCRIPT_DIR/upload-pilot-backup-to-b2.sh" "$BACKUP" "$SHA" && RESULT_BACKUP_B2=PASS || RESULT_BACKUP_B2=FAIL
else
  echo "B2_BACKUP_BLOCKED=no_credentials"
  RESULT_BACKUP_B2=BLOCKED
fi

section "9 DISK REPORT"
df -h / /var/backups/acarindex-pilot 2>/dev/null | tail -5
du -sh /var/backups/acarindex-pilot 2>/dev/null || true

section "10 REGRESSION"
REG_OK=1
bash "$SCRIPT_DIR/faz-a-beta-smoke.sh" || REG_OK=0
bash "$SCRIPT_DIR/validate-i18n-beta.sh" || REG_OK=0
curl -sf "${ACAR_BETA_BASE:-http://127.0.0.1:3002}/api/health" || REG_OK=0
if [[ "$REG_OK" == "1" ]]; then RESULT_REGRESSION=PASS; else RESULT_REGRESSION=FAIL; fi

section "11 CLOSURE DECISION"
if [[ "$RESULT_B2" == "PASS" && "$RESULT_STORAGE" == "PASS" && "$RESULT_OUTBOX" == "PASS" && "$RESULT_E2E" == "PASS" && "$RESULT_REGRESSION" == "PASS" && "$RESULT_BACKUP_B2" == "PASS" ]]; then
  CLOSURE=EVET
  FAZ_C=HAYIR
else
  CLOSURE=HAYIR
  FAZ_C=HAYIR
fi

section "12 FINAL REPORT"
cat <<EOF
=== FAZ B OPERASYONEL KAPANIŞ RAPORU ===
Tarih: $(date -Is)
Log: $LOG
Beta HEAD: $(git rev-parse HEAD)
Disk: $(df -h / | tail -1 | awk '{print $5" used "$3"/"$2}')

| Adım | Sonuç |
|------|-------|
| Pre-check | OK |
| Pre-work backup | $BACKUP |
| B2 application storage | $RESULT_B2 |
| Storage tests (18) | $RESULT_STORAGE |
| Outbox real email | $RESULT_OUTBOX |
| E2E journal + publish | $RESULT_E2E |
| Journal status audit | see log |
| Off-site B2 backup | $RESULT_BACKUP_B2 |
| Regression (beta) | $RESULT_REGRESSION |

Faz B operasyonel kapanış: $CLOSURE
Faz C başlatılabilir: $FAZ_C

Not: B2 browser setup blocker = Cursor IDE Browser MCP unavailable (browser_navigate fails with no tab).
EOF

[[ "$CLOSURE" == "EVET" ]] && exit 0
exit 1

#!/usr/bin/env bash
# Install notification outbox cron on acarindex-beta (every 5 minutes).
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

ROOT="${ACAR_ROOT:-/opt/acarindex}"
PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
LOG_FILE="${ACAR_OUTBOX_LOG:-/var/log/acarindex-outbox.log}"
CRON_MARKER="# acarindex-pilot-notification-outbox"
CRON_CMD="cd ${ROOT} && docker compose --env-file ${PILOT_ENV} -f docker-compose.pilot.yml --profile tools run --rm --no-deps etl scripts/process-notification-outbox.ts >> ${LOG_FILE} 2>&1"
CRON_LINE="*/5 * * * * ${CRON_CMD} ${CRON_MARKER}"

acar_beta_require_pilot
cd "$ROOT"

touch "$LOG_FILE"
chmod 640 "$LOG_FILE" 2>/dev/null || true

existing=$(crontab -l 2>/dev/null || true)
if echo "$existing" | grep -Fq "$CRON_MARKER"; then
  filtered=$(echo "$existing" | grep -Fv "$CRON_MARKER" || true)
  printf '%s\n' "$filtered" | crontab -
fi

(crontab -l 2>/dev/null || true; echo "$CRON_LINE") | crontab -

echo "OUTBOX_CRON_INSTALLED"
crontab -l | grep -F "$CRON_MARKER" || { echo "FAIL: cron line missing" >&2; exit 1; }

echo "=== MANUAL OUTBOX RUN ==="
RUN_OUT=$($ACAR_COMPOSE --profile tools run --rm --no-deps etl scripts/process-notification-outbox.ts 2>&1) || {
  echo "$RUN_OUT" | sed -E \
    -e 's/re_[A-Za-z0-9_-]+/[REDACTED]/g' \
    -e 's/(RESEND_API_KEY|password|secret|token)=[^[:space:]]+/\1=[REDACTED]/gi'
  echo "FAIL: manual outbox run failed" >&2
  exit 1
}
echo "$RUN_OUT" | grep -q 'outbox_processed=' && echo "OUTBOX_MANUAL_RUN_OK" || {
  echo "FAIL: unexpected outbox output" >&2
  exit 1
}

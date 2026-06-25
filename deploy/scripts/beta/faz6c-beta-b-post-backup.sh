#!/usr/bin/env bash
# Post-resend backup + restore-test
set -Eeuo pipefail

ROOT="${ACAR_ROOT:-/opt/acarindex}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

acar_beta_require_pilot
cd "$ROOT"

bash "$ROOT/deploy/scripts/faz6a1-beta-backup.sh" post_resend
POST_BACKUP=$(ls -t /var/backups/acarindex-pilot/pilot_pg_post_resend_*.dump | head -1)
echo "POST_BACKUP=$POST_BACKUP"
bash "$SCRIPT_DIR/faz6b-beta-restore-test.sh" "$POST_BACKUP"
echo "POST_RESEND_BACKUP_OK"

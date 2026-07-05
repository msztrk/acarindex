#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$ROOT/lib-live-source-guard.sh"
acar_dr_require_live_ssh
acar_dr_abort_if_pilot_target "${ACAR_LIVE_BACKUP_DIR:-/var/backups/acarindex-source}"
STAMP=$(date +%Y%m%d_%H%M%S)
DIR="${ACAR_LIVE_BACKUP_DIR:-/var/backups/acarindex-source}"
BASE="acarindex-live-source-${STAMP}"
ssh -o BatchMode=yes "$ACAR_LIVE_SSH_HOST" "mkdir -p '$DIR' && echo 'Implement mariadb-dump on server with utf8mb4 + single-transaction -> ${DIR}/${BASE}.sql.gz'"
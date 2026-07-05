#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$ROOT/lib-live-source-guard.sh"
acar_dr_require_live_ssh
DIR="${ACAR_LIVE_BACKUP_DIR:-/var/backups/acarindex-source}"
ssh -o BatchMode=yes "$ACAR_LIVE_SSH_HOST" "ls -lh '$DIR' 2>/dev/null || echo 'missing $DIR'"
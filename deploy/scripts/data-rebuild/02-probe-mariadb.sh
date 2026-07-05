#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$ROOT/lib-live-source-guard.sh"
acar_dr_require_live_ssh
DB="${ACAR_LIVE_MARIADB_DB:-}"
ssh -o BatchMode=yes "$ACAR_LIVE_SSH_HOST" "bash -s" <<'REMOTE'
set -euo pipefail
docker ps --format '{{.Names}} {{.Image}}' | grep -Ei 'maria|mysql' || true
REMOTE
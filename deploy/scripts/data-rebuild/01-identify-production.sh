#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-live-source-guard.sh
source "$ROOT/lib-live-source-guard.sh"
acar_dr_require_live_ssh
echo "Probing candidate: $ACAR_LIVE_SSH_HOST"
ssh -o BatchMode=yes "$ACAR_LIVE_SSH_HOST" 'set -e; echo "hostname=$(hostname -f)"; echo "ip=$(hostname -I | awk "{print \$1}")"; docker ps --format "{{.Names}}" 2>/dev/null | head -20 || true'
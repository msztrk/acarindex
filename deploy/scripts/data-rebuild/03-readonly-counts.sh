#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$ROOT/lib-live-source-guard.sh"
acar_dr_require_live_ssh
OUT="${1:-./acarindex-live-source.counts.txt}"
# Run read-only inventory on server; writes counts file locally from ssh stdout.
ssh -o BatchMode=yes "$ACAR_LIVE_SSH_HOST" 'bash -s' <<'REMOTE' | tee "$OUT"
set -euo pipefail
# Adjust container/credentials via env on server side only.
echo "# generated $(date -u +%Y-%m-%dT%H:%M:%SZ)"
REMOTE
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$ROOT/lib-live-source-guard.sh"
acar_dr_require_live_ssh
OUT="${1:-./acarindex-live-source.charset-samples.tsv}"
ssh -o BatchMode=yes "$ACAR_LIVE_SSH_HOST" 'echo "# charset samples placeholder — implement server-side SELECT"' | tee "$OUT"
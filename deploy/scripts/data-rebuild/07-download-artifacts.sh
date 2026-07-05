#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$ROOT/lib-live-source-guard.sh"
acar_dr_require_live_ssh
LOCAL="${ACAR_LOCAL_BACKUP_DIR:-/d/acarindex-backups/source}"
REMOTE="${ACAR_LIVE_BACKUP_DIR:-/var/backups/acarindex-source}"
PATTERN="${1:-acarindex-live-source-*}"
rsync -avP "${ACAR_LIVE_SSH_HOST}:${REMOTE}/${PATTERN}.sql.gz" "$LOCAL/" 
rsync -avP "${ACAR_LIVE_SSH_HOST}:${REMOTE}/${PATTERN}.sql.gz.sha256" "$LOCAL/" 2>/dev/null || true
rsync -avP "${ACAR_LIVE_SSH_HOST}:${REMOTE}/${PATTERN}.counts.txt" "$LOCAL/" 2>/dev/null || true
rsync -avP "${ACAR_LIVE_SSH_HOST}:${REMOTE}/${PATTERN}.charset-samples.tsv" "$LOCAL/" 2>/dev/null || true
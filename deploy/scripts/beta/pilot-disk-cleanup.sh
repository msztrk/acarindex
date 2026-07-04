#!/usr/bin/env bash
# Beta pilot disk cleanup — tam temizlik + Docker prune (manuel veya disk acil durumu)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/acarindex-pilot}"
DRY_RUN="${DRY_RUN:-0}"
KEEP_MILESTONE="${KEEP_MILESTONE:-2}"

log() { echo "[pilot-disk-cleanup] $*"; }

remove_if_exists() {
  local path="$1"
  if [[ -e "$path" ]]; then
    if [[ "$DRY_RUN" == "1" ]]; then
      log "DRY-RUN would remove: $path ($(du -sh "$path" 2>/dev/null | cut -f1))"
    else
      log "Removing: $path ($(du -sh "$path" 2>/dev/null | cut -f1))"
      rm -f "$path"
    fi
  fi
}

log "=== BEFORE ==="
df -h / | tail -1
docker system df 2>/dev/null || true

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY-RUN retention only (KEEP_MILESTONE=$KEEP_MILESTONE)"
else
  bash "$SCRIPT_DIR/pilot-backup-retention.sh"
fi

# Eski rbac / Haziran dump'ları / boş dump
remove_if_exists "$BACKUP_DIR/acarindex_beta_pre_rbac_20260703_153635.dump"
for f in "$BACKUP_DIR"/pilot_pg_202606*.dump "$BACKUP_DIR"/pilot_pg_post_*.dump \
  "$BACKUP_DIR"/pilot_pg_faz6*.dump "$BACKUP_DIR"/pilot_pg_etl_*.dump \
  "$BACKUP_DIR"/pilot_pg_empty_.dump; do
  [[ -f "$f" ]] || continue
  remove_if_exists "$f"
done

if [[ "$DRY_RUN" != "1" ]]; then
  log "=== DOCKER PRUNE (no volumes) ==="
  docker builder prune -af 2>/dev/null || true
  docker image prune -af 2>/dev/null || true
  journalctl --vacuum-size=100M 2>/dev/null || true
fi

log "=== AFTER ==="
df -h / | tail -1
docker system df 2>/dev/null || true
log "PILOT_DISK_CLEANUP_OK"

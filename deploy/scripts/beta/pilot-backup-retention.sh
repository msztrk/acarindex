#!/usr/bin/env bash
# Pilot yedek saklama — migration backup sonrası otomatik çalışır (Docker prune yapmaz)
set -Eeuo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/acarindex-pilot}"
KEEP_MILESTONE="${KEEP_MILESTONE:-2}"
KEEP_DAILY="${KEEP_DAILY:-1}"
JUST_CREATED="${1:-}"

log() { echo "[pilot-backup-retention] $*"; }

# En yeni KEEP_MILESTONE adet pilot_pg_pre_*.dump tut
mapfile -t ALL_PRE < <(ls -t "$BACKUP_DIR"/pilot_pg_pre_*.dump 2>/dev/null || true)

if [[ ${#ALL_PRE[@]} -gt $KEEP_MILESTONE ]]; then
  for ((i = KEEP_MILESTONE; i < ${#ALL_PRE[@]}; i++)); do
    f="${ALL_PRE[$i]}"
    [[ -n "$JUST_CREATED" && "$f" == "$JUST_CREATED" ]] && continue
    log "Removing old milestone: $f"
    rm -f "$f"
  done
fi

# Count sidecar — yalnızca kalan dump'lar için tutulamaz; hepsini sil (küçük)
for f in "$BACKUP_DIR"/*_counts_*.txt; do
  [[ -f "$f" ]] || continue
  rm -f "$f"
done

# daily/ — en yeni KEEP_DAILY adet
if [[ -d "$BACKUP_DIR/daily" ]]; then
  mapfile -t DAILY < <(ls -t "$BACKUP_DIR"/daily/pilot_pg_*.dump 2>/dev/null || true)
  if [[ ${#DAILY[@]} -gt $KEEP_DAILY ]]; then
    for ((i = KEEP_DAILY; i < ${#DAILY[@]}; i++)); do
      log "Removing old daily: ${DAILY[$i]}"
      rm -f "${DAILY[$i]}" "${DAILY[$i]}.sha256" 2>/dev/null || true
    done
  fi
fi

# Disk kritikse hafif builder prune (volume'lara dokunmaz)
USE_PCT=$(df / | tail -1 | awk '{gsub(/%/,"",$5); print $5}')
if [[ "$USE_PCT" -ge 85 ]]; then
  log "Disk ${USE_PCT}% — builder prune"
  docker builder prune -af 2>/dev/null || true
fi

log "Retained milestone dumps:"
ls -lh "$BACKUP_DIR"/pilot_pg_pre_*.dump 2>/dev/null || log "(none)"
log "PILOT_BACKUP_RETENTION_OK"

#!/usr/bin/env bash
# PostgreSQL yedek — sunucuda cron ile günlük çalıştırın (ör. 02:00)
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-/var/backups/acarindex}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL gerekli" >&2
  exit 1
fi

pg_dump "$DATABASE_URL" -Fc -f "$BACKUP_DIR/acarindex_${STAMP}.dump"
echo "Backup: $BACKUP_DIR/acarindex_${STAMP}.dump"

find "$BACKUP_DIR" -name 'acarindex_*.dump' -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

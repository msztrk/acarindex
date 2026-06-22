#!/usr/bin/env bash
# PostgreSQL yedek — sunucuda çalıştırın (örnek)
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-/var/backups/acarindex}"
STAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"
# DATABASE_URL ortamından host/db çıkarın veya PG* değişkenleri kullanın
pg_dump "$DATABASE_URL" -Fc -f "$BACKUP_DIR/acarindex_${STAMP}.dump"
echo "Backup: $BACKUP_DIR/acarindex_${STAMP}.dump"

#!/usr/bin/env bash
# PostgreSQL yedek — sunucuda cron veya rehearsal test.
# DATABASE_URL ortamından okur; parola loglanmaz.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/acarindex}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP=$(date +%Y%m%d_%H%M%S)
PREFIX="${BACKUP_PREFIX:-acarindex}"

mkdir -p "$BACKUP_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL gerekli" >&2
  exit 1
fi

OUT_FILE="$BACKUP_DIR/${PREFIX}_${STAMP}.dump"

if [[ -n "${DOCKER_PG_SERVICE:-}" ]]; then
  # Örnek: DOCKER_PG_SERVICE=postgres COMPOSE_FILE=docker-compose.rehearsal.yml
  docker compose -f "${COMPOSE_FILE:-docker-compose.production.yml}" -p "${COMPOSE_PROJECT:-acarindex-production}" \
    exec -T "$DOCKER_PG_SERVICE" pg_dump -U "${POSTGRES_USER:-acarindex}" -Fc "${POSTGRES_DB:-acarindex}" > "$OUT_FILE"
else
  pg_dump "$DATABASE_URL" -Fc -f "$OUT_FILE"
fi

if [[ ! -s "$OUT_FILE" ]]; then
  echo "Backup dosyası boş veya oluşmadı" >&2
  exit 1
fi

echo "Backup: $OUT_FILE ($(wc -c < "$OUT_FILE") bytes)"

# Retention — yalnızca bu prefix ile eşleşen dosyalar
find "$BACKUP_DIR" -name "${PREFIX}_*.dump" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

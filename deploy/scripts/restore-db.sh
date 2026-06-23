#!/usr/bin/env bash
# PostgreSQL restore — bakım penceresinde veya restore-test DB için.
# Kullanım: restore-db.sh /path/to/dump.dump [hedef_db_adı]
set -euo pipefail

DUMP_FILE="${1:?Usage: restore-db.sh /path/to/dump.dump [target_db]}"
TARGET_DB="${2:-}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL gerekli" >&2
  exit 1
fi

if [[ -n "${DOCKER_PG_SERVICE:-}" ]]; then
  COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
  COMPOSE_PROJECT="${COMPOSE_PROJECT:-acarindex-production}"
  PG_USER="${POSTGRES_USER:-acarindex}"
  if [[ -n "$TARGET_DB" ]]; then
    docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" exec -T "$DOCKER_PG_SERVICE" \
      psql -U "$PG_USER" -d postgres -c "DROP DATABASE IF EXISTS ${TARGET_DB};"
    docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" exec -T "$DOCKER_PG_SERVICE" \
      psql -U "$PG_USER" -d postgres -c "CREATE DATABASE ${TARGET_DB};"
    docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" exec -T "$DOCKER_PG_SERVICE" \
      pg_restore --clean --if-exists -U "$PG_USER" -d "$TARGET_DB" < "$DUMP_FILE"
  else
    docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" exec -T "$DOCKER_PG_SERVICE" \
      pg_restore --clean --if-exists -U "$PG_USER" -d "${POSTGRES_DB:-acarindex}" < "$DUMP_FILE"
  fi
else
  if [[ -n "$TARGET_DB" ]]; then
    pg_restore --clean --if-exists -d "$TARGET_DB" "$DUMP_FILE"
  else
    pg_restore --clean --if-exists -d "$DATABASE_URL" "$DUMP_FILE"
  fi
fi

echo "Restore tamamlandı: ${TARGET_DB:-primary}"

#!/usr/bin/env bash
# Faz 6B migration rehearsal — ayrı PostgreSQL (beta pilot'a UYGULANMAZ)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL gerekli (rehearsal DB)"
  exit 1
fi

echo "=== prisma validate ==="
npx prisma validate

echo "=== migrate deploy ==="
npx prisma migrate deploy

echo "=== second migrate (expect no pending) ==="
npx prisma migrate deploy

echo "=== table check ==="
npx prisma db execute --stdin <<'SQL'
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'saved_articles','reading_lists','reading_list_items',
  'followed_journals','followed_authors','notification_preferences','recent_views'
)
ORDER BY 1;
SQL

echo "REHEARSAL_MIGRATE_OK"

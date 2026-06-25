#!/usr/bin/env bash
# Faz 6C-Beta A — auth lifecycle migration + dark deploy (flags off)
set -Eeuo pipefail

ROOT="${ACAR_ROOT:-/opt/acarindex}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

BASE_LOCAL="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"
LOG="/var/log/acarindex-faz6c-beta-a-deploy.log"

acar_beta_require_pilot

exec > >(tee -a "$LOG") 2>&1

echo "=== FAZ6C BETA A DEPLOY $(date -Is) ==="
cd "$ROOT"

count_all() {
  $ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
    "SELECT 'journals' AS t, count(*)::bigint AS n FROM journals;
     SELECT 'issues', count(*)::bigint FROM issues;
     SELECT 'articles', count(*)::bigint FROM articles;
     SELECT 'pdf_files', count(*)::bigint FROM pdf_files;
     SELECT 'authors', count(*)::bigint FROM authors;
     SELECT 'article_authors', count(*)::bigint FROM article_authors;
     SELECT 'users', count(*)::bigint FROM users;
     SELECT 'sessions', count(*)::bigint FROM sessions;
     SELECT 'audit_logs', count(*)::bigint FROM audit_logs;
     SELECT 'saved_articles', count(*)::bigint FROM saved_articles;
     SELECT 'reading_lists', count(*)::bigint FROM reading_lists;"
}

set_lifecycle_flags() {
  local env_file="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
  for kv in \
    ENABLE_PUBLIC_REGISTRATION=0 \
    ENABLE_EMAIL_VERIFICATION=0 \
    ENABLE_PASSWORD_RESET=0 \
    ENABLE_CAPTCHA=0 \
    ENABLE_USER_AUTH=1 \
    ENABLE_ADMIN_PANEL=1 \
    USE_PG_AUTH=1; do
    key="${kv%%=*}"
    val="${kv#*=}"
    if grep -q "^${key}=" "$env_file"; then
      sed -i "s/^${key}=.*/${key}=${val}/" "$env_file"
    else
      echo "${key}=${val}" >> "$env_file"
    fi
  done
  if grep -q '^EMAIL_PROVIDER=' "$env_file"; then
    sed -i 's/^EMAIL_PROVIDER=.*/EMAIL_PROVIDER=console/' "$env_file"
  else
    echo 'EMAIL_PROVIDER=console' >> "$env_file"
  fi
}

echo "=== PRE CHECKS ==="
curl -sf "$BASE_LOCAL/api/health" && echo health_ok
code=$(curl -s -o /dev/null -w '%{http_code}' "https://beta.acarindex.com/" 2>/dev/null || echo "000")
if [[ "$code" == "401" ]]; then
  echo "basic_auth_external:401_ok"
else
  code_local=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_LOCAL/")
  echo "basic_auth_local:$code_local external:$code"
  [[ "$code_local" == "401" || "$code" == "401" ]] || { echo "FAIL: expected 401 without basic auth"; exit 1; }
fi
df -h / /var/backups | tail -3

echo "=== USERS ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT id, email, status FROM users ORDER BY email;"
USER_COUNT=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc "SELECT count(*) FROM users;")
USER_COUNT=$(echo "$USER_COUNT" | tr -d '[:space:]')
[[ "$USER_COUNT" == "1" ]] || { echo "FAIL: expected 1 user, got $USER_COUNT"; exit 1; }

echo "=== PRE COUNTS ==="
count_all

echo "=== PRE BACKUP ==="
bash "$ROOT/deploy/scripts/faz6a1-beta-backup.sh" pre_auth_lifecycle
PRE_BACKUP=$(ls -t /var/backups/acarindex-pilot/pilot_pg_pre_auth_lifecycle_*.dump | head -1)
echo "PRE_BACKUP=$PRE_BACKUP"

echo "=== PRE RESTORE TEST ==="
bash "$SCRIPT_DIR/faz6b-beta-restore-test.sh" "$PRE_BACKUP"

echo "=== LIFECYCLE FLAGS ==="
set_lifecycle_flags
grep -E 'ENABLE_PUBLIC|ENABLE_EMAIL|ENABLE_PASSWORD|ENABLE_CAPTCHA|ENABLE_USER|ENABLE_ADMIN|USE_PG|EMAIL_PROVIDER' \
  /etc/acarindex/pilot.env | sed 's/PASSWORD.*//'

echo "=== BUILD MIGRATE ==="
$ACAR_COMPOSE build migrate

echo "=== MIGRATE (1) ==="
$ACAR_COMPOSE --profile tools run --rm migrate

echo "=== MIGRATE (2 no-op) ==="
$ACAR_COMPOSE --profile tools run --rm migrate

echo "=== LIFECYCLE TABLES ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN (
    'legal_documents','user_legal_acceptances','account_deletion_requests','abuse_events') ORDER BY 1;
   SELECT column_name FROM information_schema.columns
     WHERE table_name='sessions' AND column_name='last_used_at';
   SELECT column_name FROM information_schema.columns
     WHERE table_name='verification_tokens' AND column_name='used_at';"

echo "=== POST MIGRATION COUNTS ==="
count_all

echo "=== BUILD APP ==="
$ACAR_COMPOSE build app

echo "=== RESTART APP ONLY ==="
$ACAR_COMPOSE --profile app up -d --no-deps app

sleep 30
curl -sf "$BASE_LOCAL/api/health" && echo

echo "FAZ6C_BETA_A_MIGRATE_AND_REBUILD_OK"

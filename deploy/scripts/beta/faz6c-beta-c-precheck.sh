#!/usr/bin/env bash
# Faz 6C-Beta C — operasyonel ön kontrol (secret değerleri yazdırılmaz)
set -Eeuo pipefail

ROOT="${ACAR_ROOT:-/opt/acarindex}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
BASE_LOCAL="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"

acar_beta_require_pilot
cd "$ROOT"

echo "=== GIT ==="
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git rev-parse origin/redesign-v2 2>/dev/null || echo "origin_fetch_needed"
git status -sb

echo "=== DOCKER ==="
$ACAR_COMPOSE ps
$ACAR_COMPOSE --profile app ps

echo "=== DISK ==="
df -h / /var/backups/acarindex-pilot 2>/dev/null | tail -5

echo "=== DATA COUNTS ==="
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT 'articles' AS k, count(*)::text FROM articles UNION ALL SELECT 'users', count(*)::text FROM users;"

echo "=== BACKUPS (latest 5) ==="
ls -lh /var/backups/acarindex-pilot/pilot_pg_*.dump 2>/dev/null | tail -5
ls -lh /var/backups/acarindex-pilot/*counts*.txt 2>/dev/null | tail -3

echo "=== NGINX ==="
nginx -t 2>&1 | tail -2
ext=$(curl -s -o /dev/null -w '%{http_code}' https://beta.acarindex.com/ 2>/dev/null || echo 000)
echo "basic_auth_no_creds=$ext"
robots=$(curl -sI https://beta.acarindex.com/ 2>/dev/null | tr -d '\r' | grep -i x-robots-tag || true)
echo "x-robots:$robots"
curl -sI https://beta.acarindex.com/ 2>/dev/null | tr -d '\r' | grep -iE 'strict-transport|expire' | head -2

echo "=== ROBOTS.TXT ==="
curl -sf $BASE_LOCAL/robots.txt 2>/dev/null | head -5 || echo "robots_local_skip"

echo "=== HEALTH + FEATURES ==="
curl -sf "$BASE_LOCAL/api/health" && echo
curl -s "$BASE_LOCAL/api/features"

echo "=== ENV FLAGS (names only) ==="
grep -E '^ENABLE_' "$PILOT_ENV" | cut -d= -f1,2 | sed 's/RESEND_API_KEY.*/RESEND_API_KEY=[REDACTED]/'

echo "=== SECRET LOG SCAN (app tail) ==="
if docker logs acarindex_pilot_app --tail 80 2>&1 | grep -qE 're_[A-Za-z0-9_-]{10,}'; then
  echo "WARN: resend_key_pattern_in_logs"
elif docker logs acarindex_pilot_app --tail 80 2>&1 | grep -qiE 'Authorization:[[:space:]]*Bearer[[:space:]]+[A-Za-z0-9._-]{8,}'; then
  echo "WARN: bearer_in_logs"
elif docker logs acarindex_pilot_app --tail 80 2>&1 | grep -qE 'postgresql://[^[:space:]]+:[^@]+@'; then
  echo "WARN: database_url_in_logs"
else
  echo "app_log_secret_scan=clean"
fi

echo "=== CRON/SYSTEMD BACKUP ==="
systemctl list-timers --all 2>/dev/null | grep -i acar || echo "no_acar_systemd_timers"
crontab -l 2>/dev/null | grep -i acar || echo "no_acar_root_cron"

echo "=== ROLLBACK DIRS ==="
ls -ld /etc/acarindex/rollback/pilot_secrets_* 2>/dev/null | tail -3 || echo "no_rotation_rollbacks_yet"

echo "FAZ6C_BETA_C_PRECHECK_OK"

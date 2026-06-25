#!/usr/bin/env bash
# Rollback pilot DB secret rotation — kullan: ACAR_ROLLBACK_DIR=/etc/acarindex/rollback/pilot_secrets_...
set -Eeuo pipefail

ROOT="${ACAR_ROOT:-/opt/acarindex}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

ROLLBACK_DIR="${ACAR_ROLLBACK_DIR:-}"
PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
MYSQL_ENV="${ACAR_PILOT_MYSQL_ENV:-/etc/acarindex/pilot-mysql.env}"
MYSQL_ADMIN_ENV="${ACAR_PILOT_MYSQL_ADMIN_ENV:-/etc/acarindex/pilot-mysql-admin.env}"

[[ -n "$ROLLBACK_DIR" && -d "$ROLLBACK_DIR" ]] || {
  echo "FAIL: ACAR_ROLLBACK_DIR gerekli" >&2
  exit 1
}

acar_beta_require_pilot
cd "$ROOT"

read_env_val() {
  local file="$1" key="$2"
  grep "^${key}=" "$file" | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//'
}

CUR_PG=$(read_env_val "$PILOT_ENV" POSTGRES_PASSWORD)
CUR_MYSQL=$(read_env_val "$MYSQL_ENV" MARIADB_ROOT_PASSWORD)
OLD_PG=$(read_env_val "$ROLLBACK_DIR/pilot.env" POSTGRES_PASSWORD)
OLD_MYSQL=$(read_env_val "$ROLLBACK_DIR/pilot-mysql.env" MARIADB_ROOT_PASSWORD)
OLD_ETL=$(read_env_val "$ROLLBACK_DIR/pilot.env" SOURCE_MYSQL_ETL_PASSWORD)
PG_USER=$(read_env_val "$ROLLBACK_DIR/pilot.env" POSTGRES_USER)
PG_DB=$(read_env_val "$ROLLBACK_DIR/pilot.env" POSTGRES_DB)
ETL_USER=$(read_env_val "$ROLLBACK_DIR/pilot.env" SOURCE_MYSQL_ETL_USER)

echo "=== Revert DB passwords to rollback snapshot ==="
$ACAR_COMPOSE exec -T -e PGPASSWORD="$CUR_PG" postgres \
  psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 \
  -c "ALTER USER ${PG_USER} WITH PASSWORD '${OLD_PG}';"

$ACAR_COMPOSE exec -T mariadb mariadb -uroot -p"$CUR_MYSQL" -e \
  "ALTER USER 'root'@'%' IDENTIFIED BY '${OLD_MYSQL}';
   ALTER USER '${ETL_USER}'@'%' IDENTIFIED BY '${OLD_ETL}';
   FLUSH PRIVILEGES;"

cp -a "$ROLLBACK_DIR/pilot.env" "$PILOT_ENV"
cp -a "$ROLLBACK_DIR/pilot-mysql.env" "$MYSQL_ENV"
[[ -f "$ROLLBACK_DIR/pilot-mysql-admin.env" ]] && cp -a "$ROLLBACK_DIR/pilot-mysql-admin.env" "$MYSQL_ADMIN_ENV"
chmod 600 "$PILOT_ENV" "$MYSQL_ENV" "$MYSQL_ADMIN_ENV" 2>/dev/null || true

$ACAR_COMPOSE up -d --force-recreate --no-deps mariadb
sleep 15
$ACAR_COMPOSE --profile app up -d --no-deps app
sleep 20
curl -sf http://127.0.0.1:3002/api/health && echo
echo "ROLLBACK_OK"

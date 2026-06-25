#!/usr/bin/env bash
# Faz 6C-Beta C — pilot DB secret rotasyonu (volume silmez, down -v yok)
# Parolalar stdout/log/Git'e yazılmaz. Rollback: faz6c-beta-c-rollback-db-secrets.sh
set -Eeuo pipefail

ROOT="${ACAR_ROOT:-/opt/acarindex}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
MYSQL_ENV="${ACAR_PILOT_MYSQL_ENV:-/etc/acarindex/pilot-mysql.env}"
MYSQL_ADMIN_ENV="${ACAR_PILOT_MYSQL_ADMIN_ENV:-/etc/acarindex/pilot-mysql-admin.env}"
TS=$(date +%Y%m%d_%H%M%S)
ROLLBACK_DIR="/etc/acarindex/rollback/pilot_secrets_${TS}"
LOG="/var/log/acarindex-faz6c-beta-c-rotate.log"

acar_beta_require_pilot
cd "$ROOT"

exec > >(tee -a "$LOG") 2>&1
echo "=== FAZ6C BETA C SECRET ROTATION ${TS} ==="

[[ -f "$PILOT_ENV" && -f "$MYSQL_ENV" ]] || { echo "FAIL: env files missing"; exit 1; }

install -d -m 700 /etc/acarindex/rollback
install -d -m 700 "$ROLLBACK_DIR"
cp -a "$PILOT_ENV" "$ROLLBACK_DIR/pilot.env"
cp -a "$MYSQL_ENV" "$ROLLBACK_DIR/pilot-mysql.env"
[[ -f "$MYSQL_ADMIN_ENV" ]] && cp -a "$MYSQL_ADMIN_ENV" "$ROLLBACK_DIR/pilot-mysql-admin.env"
chmod 600 "$ROLLBACK_DIR"/* 2>/dev/null || true
echo "ROLLBACK_DIR=$ROLLBACK_DIR"

# Pre-rotation DB backup
bash "$ROOT/deploy/scripts/faz6a1-beta-backup.sh" pre_secret_rotation

urlencode() { python3 -c "import urllib.parse; print(urllib.parse.quote('''$1''', safe=''))"; }

read_env_val() {
  local file="$1" key="$2"
  grep "^${key}=" "$file" | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//'
}

OLD_PG_PASS=$(read_env_val "$ROLLBACK_DIR/pilot.env" POSTGRES_PASSWORD)
OLD_MYSQL_ROOT=$(read_env_val "$ROLLBACK_DIR/pilot-mysql.env" MARIADB_ROOT_PASSWORD)
OLD_ETL_PASS=$(read_env_val "$ROLLBACK_DIR/pilot.env" SOURCE_MYSQL_ETL_PASSWORD)
PG_USER=$(read_env_val "$ROLLBACK_DIR/pilot.env" POSTGRES_USER)
PG_DB=$(read_env_val "$ROLLBACK_DIR/pilot.env" POSTGRES_DB)
ETL_USER=$(read_env_val "$ROLLBACK_DIR/pilot.env" SOURCE_MYSQL_ETL_USER)
MYSQL_DB=$(read_env_val "$ROLLBACK_DIR/pilot-mysql.env" MARIADB_DATABASE)

[[ -n "$OLD_PG_PASS" && -n "$OLD_MYSQL_ROOT" && -n "$OLD_ETL_PASS" && -n "$ETL_USER" ]] || {
  echo "FAIL: could not read current credentials from rollback copy"
  exit 1
}

NEW_PG_PASS=$(openssl rand -hex 32)
NEW_MYSQL_ROOT=$(openssl rand -hex 32)
NEW_ETL_PASS=$(openssl rand -hex 32)

NEW_PG_ENC=$(urlencode "$NEW_PG_PASS")
NEW_MYSQL_ENC=$(urlencode "$NEW_MYSQL_ROOT")
NEW_ETL_ENC=$(urlencode "$NEW_ETL_PASS")

echo "=== ALTER PostgreSQL user password ==="
$ACAR_COMPOSE exec -T -e PGPASSWORD="$OLD_PG_PASS" postgres \
  psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 \
  -c "ALTER USER ${PG_USER} WITH PASSWORD '${NEW_PG_PASS}';"

echo "=== ALTER MariaDB root + ETL reader ==="
$ACAR_COMPOSE exec -T mariadb mariadb -uroot -p"$OLD_MYSQL_ROOT" -e \
  "ALTER USER 'root'@'%' IDENTIFIED BY '${NEW_MYSQL_ROOT}';
   ALTER USER '${ETL_USER}'@'%' IDENTIFIED BY '${NEW_ETL_PASS}';
   FLUSH PRIVILEGES;"

echo "=== Update env files ==="
export ROLLBACK_DIR PILOT_ENV MYSQL_ENV MYSQL_ADMIN_ENV
export PG_USER PG_DB MYSQL_DB ETL_USER
export NEW_PG_PASS NEW_PG_ENC NEW_MYSQL_ROOT NEW_MYSQL_ENC NEW_ETL_PASS NEW_ETL_ENC
python3 <<'PY'
import re
import os
from pathlib import Path

rollback = Path(os.environ["ROLLBACK_DIR"])
pilot = Path(os.environ["PILOT_ENV"])
mysql = Path(os.environ["MYSQL_ENV"])
admin = Path(os.environ["MYSQL_ADMIN_ENV"])

pg_user = os.environ["PG_USER"]
pg_db = os.environ["PG_DB"]
pg_pass = os.environ["NEW_PG_PASS"]
pg_enc = os.environ["NEW_PG_ENC"]
mysql_root = os.environ["NEW_MYSQL_ROOT"]
mysql_enc = os.environ["NEW_MYSQL_ENC"]
etl_user = os.environ["ETL_USER"]
etl_pass = os.environ["NEW_ETL_PASS"]
etl_enc = os.environ["NEW_ETL_ENC"]
mysql_db = os.environ["MYSQL_DB"]

def set_kv(path: Path, updates: dict):
    text = path.read_text()
    for key, val in updates.items():
        if re.search(f"^{key}=", text, re.M):
            text = re.sub(f"^{key}=.*$", f"{key}={val}", text, count=1, flags=re.M)
        else:
            text += f"\n{key}={val}\n"
    path.write_text(text)

set_kv(pilot, {
    "POSTGRES_PASSWORD": pg_pass,
    "PILOT_POSTGRES_PASSWORD": pg_pass,
    "DATABASE_URL": f"postgresql://{pg_user}:{pg_enc}@postgres:5432/{pg_db}",
    "PILOT_DATABASE_URL": f"postgresql://{pg_user}:{pg_enc}@postgres:5432/{pg_db}",
    "SOURCE_MYSQL_ETL_PASSWORD": etl_pass,
    "SOURCE_DATABASE_URL": f"mysql://{etl_user}:{etl_enc}@mariadb:3306/{mysql_db}",
    "PILOT_SOURCE_DATABASE_URL": f"mysql://{etl_user}:{etl_enc}@mariadb:3306/{mysql_db}",
})

set_kv(mysql, {
    "MARIADB_ROOT_PASSWORD": mysql_root,
    "PILOT_MYSQL_ROOT_PASSWORD": mysql_root,
})

if admin.exists():
    set_kv(admin, {
        "SOURCE_MYSQL_ADMIN_URL": f"mysql://root:{mysql_enc}@127.0.0.1:3308/{mysql_db}",
        "SOURCE_MYSQL_ETL_PASSWORD": etl_pass,
    })
PY

chmod 600 "$PILOT_ENV" "$MYSQL_ENV"
[[ -f "$MYSQL_ADMIN_ENV" ]] && chmod 600 "$MYSQL_ADMIN_ENV"
chown root:root "$PILOT_ENV" "$MYSQL_ENV" "$MYSQL_ADMIN_ENV" 2>/dev/null || true

echo "=== Recreate mariadb + restart app (postgres volume untouched) ==="
$ACAR_COMPOSE up -d --force-recreate --no-deps mariadb
for i in $(seq 1 30); do
  if $ACAR_COMPOSE exec -T mariadb mariadb-admin ping -h 127.0.0.1 -uroot -p"$NEW_MYSQL_ROOT" --silent 2>/dev/null; then
    echo "mariadb_healthy"
    break
  fi
  sleep 2
done

$ACAR_COMPOSE --profile app up -d --no-deps app
sleep 25

echo "=== VERIFY new credentials ==="
$ACAR_COMPOSE exec -T -e PGPASSWORD="$NEW_PG_PASS" postgres \
  psql -U "$PG_USER" -d "$PG_DB" -tAc "SELECT count(*) FROM articles;" | tr -d '[:space:]'
echo "articles_ok"

$ACAR_COMPOSE exec -T mariadb mariadb -uroot -p"$NEW_MYSQL_ROOT" -N -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${MYSQL_DB}';"

curl -sf http://127.0.0.1:3002/api/health && echo " health_ok"

echo "=== VERIFY old credentials rejected ==="
if $ACAR_COMPOSE exec -T -e PGPASSWORD="$OLD_PG_PASS" postgres \
  psql -U "$PG_USER" -d "$PG_DB" -tAc "SELECT 1;" 2>/dev/null; then
  echo "FAIL: old postgres password still works"
  exit 1
fi
echo "old_postgres_rejected"

if $ACAR_COMPOSE exec -T mariadb mariadb -uroot -p"$OLD_MYSQL_ROOT" -e "SELECT 1;" 2>/dev/null; then
  echo "FAIL: old mysql root password still works"
  exit 1
fi
echo "old_mysql_root_rejected"

echo "ROLLBACK_CMD=ACAR_ROLLBACK_DIR=$ROLLBACK_DIR bash $ROOT/deploy/scripts/beta/faz6c-beta-c-rollback-db-secrets.sh"
echo "SECRET_ROTATION_OK"

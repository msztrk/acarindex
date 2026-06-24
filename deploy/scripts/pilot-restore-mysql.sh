#!/usr/bin/env bash
# Pilot MariaDB restore — host mariadb client → 127.0.0.1:3308 (acarindex_pilot_mysql)
set -euo pipefail

LOG=/var/log/acarindex-pilot-restore.log
exec > >(tee -a "$LOG") 2>&1

echo "=== restore start $(date -Is) ==="
df -h /
free -h

set -a
source /etc/acarindex/pilot-mysql-admin.env
set +a

SQL_PATH="${LOCAL_SOURCE_SQL_PATH:-/var/lib/acarindex-transfer/acarinde_yeniacarindex.sql}"
if [[ ! -f "$SQL_PATH" ]]; then
  echo "SQL dosyası yok: $SQL_PATH" >&2
  exit 1
fi

eval "$(python3 <<'PY'
import os, urllib.parse, shlex
url = os.environ["SOURCE_MYSQL_ADMIN_URL"].replace("mysql://", "http://")
u = urllib.parse.urlparse(url)
host = u.hostname or "127.0.0.1"
port = u.port or 3306
user = urllib.parse.unquote(u.username or "")
password = urllib.parse.unquote(u.password or "")
database = (u.path or "").lstrip("/")
print(f"export MYSQL_HOST={shlex.quote(host)}")
print(f"export MYSQL_PORT={port}")
print(f"export MYSQL_USER={shlex.quote(user)}")
print(f"export MYSQL_PASS={shlex.quote(password)}")
print(f"export MYSQL_DB={shlex.quote(database)}")
PY
)"

export MYSQL_PWD="$MYSQL_PASS"

echo "restore_target_host=$MYSQL_HOST port=$MYSQL_PORT db=$MYSQL_DB file=$(basename "$SQL_PATH")"

mariadb -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" \
  -e "CREATE DATABASE IF NOT EXISTS \`${MYSQL_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

echo "import_start $(date -Is)"
mariadb -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" \
  --default-character-set=utf8mb4 "$MYSQL_DB" < "$SQL_PATH"
echo "import_end $(date -Is)"

TABLE_COUNT=$(mariadb -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -N \
  -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${MYSQL_DB}'")
MAKALE_COUNT=$(mariadb -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -N \
  -e "SELECT COUNT(*) FROM \`${MYSQL_DB}\`.makaleler" 2>/dev/null || echo "0")

unset MYSQL_PWD

echo "restore_complete tables=$TABLE_COUNT makaleler=$MAKALE_COUNT"
df -h /
free -h
echo "=== restore end $(date -Is) ==="

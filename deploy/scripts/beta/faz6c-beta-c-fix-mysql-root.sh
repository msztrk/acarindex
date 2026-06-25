#!/usr/bin/env bash
# MariaDB root parolasını env ile senkronize et (volume silmez)
set -Eeuo pipefail
RB="${ACAR_ROLLBACK_DIR:-/etc/acarindex/rollback/pilot_secrets_20260625_211702}"
MYSQL_ENV=/etc/acarindex/pilot-mysql.env
COMPOSE="docker compose --env-file /etc/acarindex/pilot.env -f /opt/acarindex/docker-compose.pilot.yml"

read_env() { grep "^$2=" "$1" | cut -d= -f2- | tr -d '\r'; }
OLD=$(read_env "$RB/pilot-mysql.env" MARIADB_ROOT_PASSWORD)
TARGET=$(read_env "$MYSQL_ENV" MARIADB_ROOT_PASSWORD)

$COMPOSE exec -T mariadb mariadb -uroot -p"$OLD" -e \
  "ALTER USER 'root'@'%' IDENTIFIED BY '${TARGET}';
   ALTER USER 'root'@'localhost' IDENTIFIED BY '${TARGET}';
   FLUSH PRIVILEGES;" && echo MYSQL_SYNC_OK

$COMPOSE exec -T mariadb mariadb -uroot -p"$TARGET" -e "SELECT 1" >/dev/null && echo MYSQL_VERIFY_OK

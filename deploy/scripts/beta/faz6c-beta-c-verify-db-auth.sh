#!/usr/bin/env bash
# Verify DB URL auth without printing secrets
set -Eeuo pipefail
RB="${1:-}"
[[ -f "$RB/pilot.env" ]] || exit 1
read_env() { grep "^$2=" "$1" | cut -d= -f2- | tr -d '\r'; }
OLD_URL=$(read_env "$RB/pilot.env" DATABASE_URL)
NEW_URL=$(read_env /etc/acarindex/pilot.env DATABASE_URL)
COMPOSE="docker compose --env-file /etc/acarindex/pilot.env -f /opt/acarindex/docker-compose.pilot.yml"

test_pg_url() {
  local url="$1"
  $COMPOSE exec -T postgres psql "$url" -tAc "SELECT 1" >/dev/null 2>&1
}

if test_pg_url "$NEW_URL"; then echo new_pg_url_ok; else echo new_pg_url_fail; exit 1; fi
if test_pg_url "$OLD_URL"; then echo old_pg_url_still_works; exit 1; else echo old_pg_url_rejected; fi

OLD_MY=$(read_env "$RB/pilot-mysql.env" MARIADB_ROOT_PASSWORD)
NEW_MY=$(read_env /etc/acarindex/pilot-mysql.env MARIADB_ROOT_PASSWORD)
if $COMPOSE exec -T mariadb mariadb -uroot -p"$NEW_MY" -e "SELECT 1" >/dev/null 2>&1; then echo new_mysql_ok; else echo new_mysql_fail; exit 1; fi
if $COMPOSE exec -T mariadb mariadb -uroot -p"$OLD_MY" -e "SELECT 1" >/dev/null 2>&1; then echo old_mysql_still_works; exit 1; else echo old_mysql_rejected; fi
echo VERIFY_URL_AUTH_OK

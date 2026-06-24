#!/usr/bin/env bash
# Pilot env dosyalarını oluşturur — parolalar stdout'a yazılmaz
set -euo pipefail

install -d -m 700 /etc/acarindex
install -d -m 700 /var/lib/acarindex-transfer
install -d -m 700 /var/backups/acarindex-pilot

PG_PASS=$(openssl rand -base64 24)
MYSQL_ROOT=$(openssl rand -base64 24)
ETL_READER=$(openssl rand -base64 24)

PG_USER=acarindex_pilot
PG_DB=acarindex_pilot
MYSQL_DB=acarindex_source_pilot
ETL_USER=acarindex_etl_reader

urlencode() { python3 -c "import urllib.parse; print(urllib.parse.quote('''$1''', safe=''))"; }

PG_PASS_ENC=$(urlencode "$PG_PASS")
ETL_PASS_ENC=$(urlencode "$ETL_READER")

cat > /etc/acarindex/pilot.env <<EOF
APP_ENV=staging
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://beta.acarindex.com
NEXT_PUBLIC_CANONICAL_BASE=https://www.acarindex.com
POSTGRES_USER=${PG_USER}
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=${PG_DB}
DATABASE_URL=postgresql://${PG_USER}:${PG_PASS_ENC}@postgres:5432/${PG_DB}
PILOT_DATABASE_URL=postgresql://${PG_USER}:${PG_PASS_ENC}@postgres:5432/${PG_DB}
USE_SUPABASE_DB=0
ENABLE_USER_AUTH=false
NEXT_PUBLIC_ENABLE_USER_AUTH=false
LEGACY_FILE_BASE_URL=https://www.acarindex.com
AUTHOR_REGISTRY_MODE=provisional-only
ALLOW_PILOT_DOCKER_SOURCE=1
SOURCE_MYSQL_ETL_USER=${ETL_USER}
SOURCE_MYSQL_ETL_PASSWORD=${ETL_READER}
EOF

cat > /etc/acarindex/pilot-mysql.env <<EOF
MARIADB_ROOT_PASSWORD=${MYSQL_ROOT}
MARIADB_DATABASE=${MYSQL_DB}
EOF

# ETL reader URL — restore sonrası etl container için
cat >> /etc/acarindex/pilot.env <<EOF
SOURCE_DATABASE_URL=mysql://${ETL_USER}:${ETL_PASS_ENC}@mariadb:3306/${MYSQL_DB}
PILOT_SOURCE_DATABASE_URL=mysql://${ETL_USER}:${ETL_PASS_ENC}@mariadb:3306/${MYSQL_DB}
EOF

chmod 600 /etc/acarindex/pilot.env /etc/acarindex/pilot-mysql.env

# Admin URL for host-side restore (127.0.0.1:3308)
MYSQL_ROOT_ENC=$(urlencode "$MYSQL_ROOT")
cat > /etc/acarindex/pilot-mysql-admin.env <<EOF
SOURCE_MYSQL_ADMIN_URL=mysql://root:${MYSQL_ROOT_ENC}@127.0.0.1:3308/${MYSQL_DB}
LOCAL_SOURCE_SQL_PATH=/var/lib/acarindex-transfer/acarinde_yeniacarindex.sql
SOURCE_MYSQL_ETL_USER=${ETL_USER}
SOURCE_MYSQL_ETL_PASSWORD=${ETL_READER}
EOF
chmod 600 /etc/acarindex/pilot-mysql-admin.env

echo "PILOT_ENV_CREATED"

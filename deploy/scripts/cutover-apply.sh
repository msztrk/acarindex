#!/usr/bin/env bash
# Public beta cutover: upstream 3000 -> 3002
set -euo pipefail

BETA_CONF="/etc/nginx/sites-available/beta.acarindex.com"
BACKUP_DIR="/var/backups/acarindex-beta"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
CUTOVER_LOG="/var/log/acarindex-cutover-${TIMESTAMP}.log"
PROBE_USER="cutover_probe_$$"
PROBE_PASS=$(openssl rand -base64 18 | tr -d '/+=' | head -c 16)

exec > >(tee -a "$CUTOVER_LOG") 2>&1
echo "=== CUTOVER START $(date -Is) ==="

# --- Step 3: nginx config backup ---
NGINX_BACKUP="${BACKUP_DIR}/nginx-pre-cutover-${TIMESTAMP}.conf"
cp -a "$BETA_CONF" "$NGINX_BACKUP"
sha256sum "$NGINX_BACKUP"
echo "NGINX_BACKUP=$NGINX_BACKUP"

# --- Step 4: upstream change ---
sed -i 's/server 127.0.0.1:3000;/server 127.0.0.1:3002;/' "$BETA_CONF"
grep -A2 'upstream acarindex_app' "$BETA_CONF"

# --- Step 5: nginx -t ---
if ! nginx -t; then
  echo "NGINX_TEST_FAILED — restoring config"
  cp -a "$NGINX_BACKUP" "$BETA_CONF"
  nginx -t
  exit 1
fi
echo "NGINX_TEST_OK"

systemctl reload nginx
echo "NGINX_RELOAD_OK $(date -Is)"

# Add temporary probe user for authenticated external tests
htpasswd -bB /etc/nginx/.htpasswd-acarindex-beta "$PROBE_USER" "$PROBE_PASS" 2>/dev/null
AUTH_HDR="-u ${PROBE_USER}:${PROBE_PASS}"

echo "PROBE_USER=$PROBE_USER (will be removed after tests)"

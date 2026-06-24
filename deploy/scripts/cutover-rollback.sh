#!/usr/bin/env bash
set -euo pipefail
BETA_CONF="/etc/nginx/sites-available/beta.acarindex.com"
BACKUP="$1"
PROBE_USER="$2"

echo "=== ROLLBACK START $(date -Is) ==="
sed -i 's/server 127.0.0.1:3002;/server 127.0.0.1:3000;/' "$BETA_CONF"
nginx -t
systemctl reload nginx
echo "ROLLBACK_RELOAD_OK"

# Remove probe user if exists
if [[ -n "$PROBE_USER" ]]; then
  htpasswd -D /etc/nginx/.htpasswd-acarindex-beta "$PROBE_USER" 2>/dev/null || true
fi

echo "=== SYNTHETIC SMOKE 3000 ==="
curl -s -o /dev/null -w "synthetic_home:%{http_code}\n" http://127.0.0.1:3000/
curl -s http://127.0.0.1:3000/api/health

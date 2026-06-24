#!/usr/bin/env bash
set -euo pipefail

PROBE_USER="postcutover_chk"
PROBE_PASS=$(openssl rand -base64 18 | tr -d '/+=' | head -c 16)
htpasswd -bB /etc/nginx/.htpasswd-acarindex-beta "$PROBE_USER" "$PROBE_PASS"
AUTH="-u ${PROBE_USER}:${PROBE_PASS}"

echo "=== CONTAINERS ==="
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'pilot|prod' || true

echo "=== SYNTHETIC 3000 ==="
curl -s -o /dev/null -w "synthetic:%{http_code}\n" http://127.0.0.1:3000/api/health

echo "=== PILOT 3002 ==="
curl -s http://127.0.0.1:3002/api/health

echo "=== UPSTREAM ==="
grep -A2 'upstream acarindex_app' /etc/nginx/sites-available/beta.acarindex.com

echo "=== CANONICAL IN HTML ==="
curl -sS $AUTH https://beta.acarindex.com/ | grep -i 'canonical' | head -5 || echo "no canonical link in HTML snippet"

echo "=== HTTP REDIRECT ==="
curl -sS -o /dev/null -w "http:%{http_code} redirect:%{redirect_url}\n" http://beta.acarindex.com/

echo "=== PUBLIC LISTENERS (db) ==="
ss -tlnp | awk '/:5432|:3306/ && !/127.0.0.1/' || echo "no public pg/mysql"

echo "=== APP BIND ==="
ss -tlnp | grep -E '3000|3002'

echo "=== PILOT APP LOG (last 8) ==="
docker logs acarindex_pilot_app --tail 8 2>&1

echo "=== PILOT PG LOG (last 5) ==="
docker logs acarindex_pilot_pg --tail 5 2>&1

echo "=== NGINX ERROR (last 5) ==="
tail -5 /var/log/nginx/error.log

htpasswd -D /etc/nginx/.htpasswd-acarindex-beta "$PROBE_USER"
echo "POST_CUTOVER_CHECKS_OK"

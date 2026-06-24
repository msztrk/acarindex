#!/usr/bin/env bash
set -euo pipefail

PILOT_COMPOSE="docker compose --env-file /etc/acarindex/pilot.env -f /opt/acarindex/docker-compose.pilot.yml"
PROD_COMPOSE="docker compose --env-file /etc/acarindex/beta.env -f /opt/acarindex/docker-compose.production.yml"

echo "=== DISK ==="
df -h / | tail -1

echo "=== CONTAINER HEALTH ==="
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'pilot_app|prod_app|pilot_pg|prod_pg' || true

echo "=== PILOT HEALTH ==="
curl -s -o /tmp/pilot_health.json -w "pilot_health_http:%{http_code}\n" http://127.0.0.1:3002/api/health
cat /tmp/pilot_health.json
echo

echo "=== PILOT HOME ==="
curl -s -o /dev/null -w "pilot_home:%{http_code}\n" http://127.0.0.1:3002/

echo "=== PILOT ARTICLE (33035) ==="
curl -s -o /dev/null -w "pilot_article:%{http_code}\n" \
  "http://127.0.0.1:3002/gazi-universitesi-muhendislik-mimarlik-fakultesi-dergisi/cok-katli-bir-bina-etrafindaki-ruzgar-akisinin-olusturdugu-yuzey-basinclarinin-deneysel-olarak-incelenmesi-33035-33035"

echo "=== PILOT PDF PROXY ==="
curl -s -o /tmp/pilot_pdf.bin -w "pilot_pdf:%{http_code}:%{content_type}:%{size_download}\n" \
  http://127.0.0.1:3002/api/pdf-proxy/33035
head -c 5 /tmp/pilot_pdf.bin; echo

echo "=== PROD SYNTHETIC 3000 ==="
curl -s -o /dev/null -w "prod_home:%{http_code}\n" http://127.0.0.1:3000/

echo "=== NGINX HTTPASSWD ==="
test -f /etc/nginx/.htpasswd-acarindex-beta && echo "htpasswd:exists" || echo "htpasswd:MISSING"

echo "=== NGINX CONFIG PATH ==="
ls -la /etc/nginx/sites-enabled/
BETA_CONF=$(ls /etc/nginx/sites-enabled/beta.acarindex.com 2>/dev/null || ls /etc/nginx/sites-enabled/*beta* 2>/dev/null | head -1)
echo "BETA_CONF=$BETA_CONF"
grep -E 'upstream|127.0.0.1' "$BETA_CONF" | head -5

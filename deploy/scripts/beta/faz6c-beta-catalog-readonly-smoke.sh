#!/usr/bin/env bash
# Salt-okunur katalog regresyonu — oturum cookie kullanmaz, recent_views değiştirmez.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

BASE="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"
NGX_USER="catalog_ro_$(date +%s)"
NGX_PASS=$(openssl rand -base64 12 | tr -d '/+=' | head -c 12)
TMP_PDF=""

cleanup() {
  htpasswd -D /etc/nginx/.htpasswd-acarindex-beta "$NGX_USER" 2>/dev/null || true
  rm -f "$TMP_PDF"
}
trap cleanup EXIT

fail() { echo "FAIL: $1" >&2; exit 1; }
trim() { acar_beta_trim; }

acar_beta_require_pilot
htpasswd -bB /etc/nginx/.htpasswd-acarindex-beta "$NGX_USER" "$NGX_PASS" 2>/dev/null
AUTH="-u ${NGX_USER}:${NGX_PASS}"

for path in / /search?q=enerji /journals /istatistikler /sitemap.xml /api/health; do
  code=$(curl -sS $AUTH -o /dev/null -w '%{http_code}' "$BASE$path")
  echo "$path:$code"
  [[ "$code" == "200" ]] || fail "$path"
done

robots=$(curl -sS $AUTH "$BASE/robots.txt")
echo "$robots" | grep -q 'Disallow: /' || fail robots
code=$(curl -sS $AUTH -o /dev/null -w '%{http_code}' "$BASE/nonexistent-404-test")
[[ "$code" == "404" ]] || fail 404

JSLUG=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc "SELECT slug FROM journals ORDER BY id LIMIT 1;" | trim)
ARTPATH=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT a.legacy_journal_slug || '/' || a.slug || '-' || a.id FROM articles a ORDER BY a.id LIMIT 1;" | trim)
ISSUE_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc "SELECT i.id FROM issues i ORDER BY i.id LIMIT 1;" | trim)
ARTICLE_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT a.id FROM articles a JOIN pdf_files p ON p.article_id=a.id WHERE p.file_status!='missing' ORDER BY a.id LIMIT 1;" | trim)
AUTHSLUG=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT slug || '-' || id FROM authors ORDER BY id LIMIT 1;" | trim)

for path in "/journals/${JSLUG}" "/journals/${JSLUG}/sayi/${ISSUE_ID}" "/${ARTPATH}" "/authors/${AUTHSLUG}"; do
  code=$(curl -sS $AUTH -g -o /dev/null -w '%{http_code}' "$BASE$path")
  echo "entity $path:$code"
  [[ "$code" == "200" ]] || fail "$path"
done

TMP_PDF="/tmp/catalog-ro-$$.pdf"
meta=$(curl -sS $AUTH -o "$TMP_PDF" -w '%{http_code}:%{content_type}' "$BASE/api/pdf-proxy/$ARTICLE_ID")
echo "pdf:$meta"
head -c 5 "$TMP_PDF" | grep -q '%PDF' || fail pdf

echo "CATALOG_READONLY_SMOKE_OK"

#!/usr/bin/env bash
# Faz 6B beta — catalog regression + user panel smoke (run on beta server only)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

CRED="${ACAR_ADMIN_CRED:-/root/.faz6a-admin-credentials}"
BASE="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"
CJ=""
NGX_USER=""
TMP_PDF=""

cleanup() {
  if [[ -n "$NGX_USER" ]]; then
    htpasswd -D /etc/nginx/.htpasswd-acarindex-beta "$NGX_USER" 2>/dev/null || true
  fi
  rm -f "$CJ" "$TMP_PDF"
}
trap cleanup EXIT

fail() { echo "FAIL: $1" >&2; exit 1; }

acar_beta_require_pilot

if [[ ! -f "$CRED" ]]; then
  echo "FAIL: credential file missing (set ACAR_ADMIN_CRED)" >&2
  exit 1
fi

EMAIL=$(grep '^email=' "$CRED" | cut -d= -f2- | tr -d '\r')
PASS=$(grep '^pass=' "$CRED" | cut -d= -f2- | tr -d '\r')
[[ -n "$EMAIL" && -n "$PASS" ]] || fail "credential file format"

NGX_USER="faz6b_probe_$(date +%s)"
NGX_PASS=$(openssl rand -base64 12 | tr -d '/+=' | head -c 12)
htpasswd -bB /etc/nginx/.htpasswd-acarindex-beta "$NGX_USER" "$NGX_PASS" 2>/dev/null
AUTH_NGX="-u ${NGX_USER}:${NGX_PASS}"

trim() { acar_beta_trim; }

echo "=== CATALOG REGRESSION ==="
for path in / /search?q=enerji /journals /istatistikler /sitemap.xml /api/health; do
  code=$(curl -sS $AUTH_NGX -o /dev/null -w '%{http_code}' "$BASE$path")
  echo "$path:$code"
  [[ "$code" == "200" ]] || fail "$path"
done

robots=$(curl -sS $AUTH_NGX "$BASE/robots.txt")
echo "$robots" | grep -q 'Disallow: /' || fail "robots disallow"
code=$(curl -sS $AUTH_NGX -o /dev/null -w '%{http_code}' "$BASE/nonexistent-faz6b-404")
[[ "$code" == "404" ]] || fail "404 page"

JSLUG=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc "SELECT slug FROM journals ORDER BY id LIMIT 1;" | trim)
ARTPATH=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT a.legacy_journal_slug || '/' || a.slug || '-' || a.id FROM articles a ORDER BY a.id LIMIT 1;" | trim)
ISSUE_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT i.id FROM issues i ORDER BY i.id LIMIT 1;" | trim)
ARTICLE_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT a.id FROM articles a JOIN pdf_files p ON p.article_id=a.id WHERE p.file_status!='missing' ORDER BY a.id LIMIT 1;" | trim)
ARTICLE_ID2=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT a.id FROM articles a JOIN pdf_files p ON p.article_id=a.id WHERE p.file_status!='missing' AND a.id > $ARTICLE_ID ORDER BY a.id LIMIT 1;" | trim)
JOURNAL_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc "SELECT id FROM journals ORDER BY id LIMIT 1;" | trim)
CANON_AUTHOR_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT id FROM authors WHERE is_provisional = false ORDER BY id LIMIT 1;" | trim)
PROV_AUTHOR_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT id FROM authors WHERE is_provisional = true ORDER BY id LIMIT 1;" | trim)
AUTHSLUG=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT slug || '-' || id FROM authors ORDER BY id LIMIT 1;" | trim)
PROVSLUG=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT slug || '-' || id FROM authors WHERE is_provisional = true ORDER BY id LIMIT 1;" | trim)

for path in "/journals/${JSLUG}" "/journals/${JSLUG}/sayi/${ISSUE_ID}" "/${ARTPATH}" "/authors/${AUTHSLUG}"; do
  code=$(curl -sS $AUTH_NGX -g -o /dev/null -w '%{http_code}' "$BASE$path")
  echo "entity $path:$code"
  [[ "$code" == "200" ]] || fail "$path"
done
if [[ -n "$PROVSLUG" ]]; then
  code=$(curl -sS $AUTH_NGX -g -o /dev/null -w '%{http_code}' "$BASE/authors/${PROVSLUG}")
  echo "entity /authors/${PROVSLUG}:$code"
  [[ "$code" == "200" ]] || fail "provisional author page"
fi

TMP_PDF="/tmp/faz6b-smoke-$$.pdf"
pdf=$(curl -sS $AUTH_NGX -o "$TMP_PDF" -w '%{http_code}:%{content_type}' "$BASE/api/pdf-proxy/$ARTICLE_ID")
echo "pdf:$pdf"
head -c 5 "$TMP_PDF" | grep -q '%PDF' || fail "pdf content"

CJ="/tmp/faz6b-cookies-$$.txt"
rm -f "$CJ"
csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
[[ -n "$csrf" ]] || fail "csrf"

curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" -o /dev/null
grep -q acarindex_session "$CJ" || fail "session cookie"

echo "=== LOGIN PAGE ==="
code=$(curl -sS $AUTH_NGX -o /dev/null -w '%{http_code}' -L "$BASE/login")
[[ "$code" == "200" ]] || fail "login page $code"

echo "=== HESABIM PAGES ==="
for path in /hesabim /hesabim/kaydedilen /hesabim/listeler /hesabim/takip-dergiler \
  /hesabim/takip-yazarlar /hesabim/son-goruntulenen /hesabim/bildirimler /hesabim/security; do
  code=$(curl -sS $AUTH_NGX -b "$CJ" -o /dev/null -w '%{http_code}' "$BASE$path")
  echo "$path:$code"
  [[ "$code" == "200" ]] || fail "$path"
done

csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')

echo "=== SAVE ARTICLE ==="
code=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/user/saved-articles" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"articleId\":$ARTICLE_ID}" -o /dev/null -w '%{http_code}')
[[ "$code" == "200" ]] || fail "save $code"

echo "=== CREATE LIST ==="
list_json=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/user/reading-lists" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d '{"name":"Faz6B Beta List"}')
LIST_ID=$(echo "$list_json" | sed -n 's/.*"listId":"\([^"]*\)".*/\1/p')
[[ -n "$LIST_ID" ]] || fail "list create"

csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
code=$(curl -sS -b "$CJ" -c "$CJ" -X PATCH "$BASE/api/user/reading-lists/$LIST_ID" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d '{"name":"Faz6B Renamed"}' -o /dev/null -w '%{http_code}')
[[ "$code" == "200" ]] || fail "rename $code"

csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
code=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/user/reading-lists/$LIST_ID/items" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"articleId\":$ARTICLE_ID}" -o /dev/null -w '%{http_code}')
[[ "$code" == "200" ]] || fail "add item $code"

if [[ -n "$ARTICLE_ID2" ]]; then
  csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
  code=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/user/reading-lists/$LIST_ID/items" \
    -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
    -d "{\"articleId\":$ARTICLE_ID2}" -o /dev/null -w '%{http_code}')
  [[ "$code" == "200" ]] || fail "add item2 $code"
  list_detail=$(curl -sS -b "$CJ" "$BASE/api/user/reading-lists/$LIST_ID")
  ITEM1=$(echo "$list_detail" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
  ITEM2=$(echo "$list_detail" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | sed -n '2p')
  if [[ -n "$ITEM1" && -n "$ITEM2" ]]; then
    csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
    code=$(curl -sS -b "$CJ" -c "$CJ" -X PATCH "$BASE/api/user/reading-lists/$LIST_ID/items" \
      -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
      -d "{\"itemIds\":[\"$ITEM2\",\"$ITEM1\"]}" -o /dev/null -w '%{http_code}')
    [[ "$code" == "200" ]] || fail "reorder $code"
  fi
fi

csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
code=$(curl -sS -b "$CJ" -c "$CJ" -X DELETE "$BASE/api/user/reading-lists/$LIST_ID/items" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"articleId\":$ARTICLE_ID}" -o /dev/null -w '%{http_code}')
[[ "$code" == "200" ]] || fail "remove item $code"

echo "=== FOLLOW JOURNAL ==="
csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
code=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/user/follows/journals" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"journalId\":$JOURNAL_ID}" -o /dev/null -w '%{http_code}')
[[ "$code" == "200" ]] || fail "follow journal $code"

csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
code=$(curl -sS -b "$CJ" -c "$CJ" -X DELETE "$BASE/api/user/follows/journals" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"journalId\":$JOURNAL_ID}" -o /dev/null -w '%{http_code}')
[[ "$code" == "200" ]] || fail "unfollow journal $code"

if [[ -n "$CANON_AUTHOR_ID" ]]; then
  echo "=== FOLLOW CANONICAL AUTHOR ==="
  csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
  code=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/user/follows/authors" \
    -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
    -d "{\"authorId\":$CANON_AUTHOR_ID}" -o /dev/null -w '%{http_code}')
  [[ "$code" == "200" ]] || fail "follow author $code"
  csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
  code=$(curl -sS -b "$CJ" -c "$CJ" -X DELETE "$BASE/api/user/follows/authors" \
    -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
    -d "{\"authorId\":$CANON_AUTHOR_ID}" -o /dev/null -w '%{http_code}')
  [[ "$code" == "200" ]] || fail "unfollow author $code"
else
  echo "SKIP canonical author follow (no non-provisional authors in pilot catalog)"
fi

if [[ -n "$PROV_AUTHOR_ID" ]]; then
  echo "=== PROVISIONAL REJECT ==="
  csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
  body=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/user/follows/authors" \
    -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
    -d "{\"authorId\":$PROV_AUTHOR_ID}")
  echo "$body" | grep -qi provisional || fail "provisional message"
  $ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
    "SELECT count(*) FROM followed_authors WHERE author_id=$PROV_AUTHOR_ID;" | grep -q '^0$' || fail "provisional row"
fi

echo "=== NOTIFICATION PREFS ==="
csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
curl -sS -b "$CJ" -c "$CJ" -X PATCH "$BASE/api/user/notification-preferences" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d '{"weeklyDigest":true}' -o /dev/null
prefs=$(curl -sS -b "$CJ" "$BASE/api/user/notification-preferences")
echo "$prefs" | grep -q 'weeklyDigest' || fail "prefs"

echo "=== RECENT VIEWS ==="
csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/user/recent-views" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"entityType\":\"article\",\"entityId\":$ARTICLE_ID}" -o /dev/null
csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
curl -sS -b "$CJ" -c "$CJ" -X DELETE "$BASE/api/user/recent-views" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" -d '{}' -o /dev/null

echo "=== UNSAVE + DELETE LIST ==="
csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
curl -sS -b "$CJ" -c "$CJ" -X DELETE "$BASE/api/user/saved-articles" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"articleId\":$ARTICLE_ID}" -o /dev/null
csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
curl -sS -b "$CJ" -c "$CJ" -X DELETE "$BASE/api/user/reading-lists/$LIST_ID" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" -d '{}' -o /dev/null

ART_COUNT=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc "SELECT count(*) FROM articles WHERE id=$ARTICLE_ID;")
[[ "$ART_COUNT" == "1" ]] || fail "catalog article deleted"

echo "=== SECURITY SMOKE ==="
code=$(curl -sS -X POST "$BASE/api/user/saved-articles" -H "Content-Type: application/json" \
  -d "{\"articleId\":$ARTICLE_ID}" -o /dev/null -w '%{http_code}')
[[ "$code" == "401" ]] || fail "no session $code"

csrf=$(curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
code=$(curl -sS -b "$CJ" -X POST "$BASE/api/user/saved-articles" \
  -H "Content-Type: application/json" -d "{\"articleId\":$ARTICLE_ID}" -o /dev/null -w '%{http_code}')
[[ "$code" == "403" ]] || fail "no csrf $code"

body=$(curl -sS -X POST "$BASE/api/user/saved-articles" -H "Content-Type: application/json" -d '{}' 2>/dev/null || true)
echo "$body" | grep -qi 'postgresql' && fail "leak"
echo "$body" | grep -qi 'DATABASE_URL' && fail "leak"

grep acarindex_session "$CJ" | grep -qi httponly || true
grep acarindex_session "$CJ" | grep -qi samesite || true

echo "=== IDOR OTHER LIST ==="
code=$(curl -sS -b "$CJ" -o /dev/null -w '%{http_code}' \
  "$BASE/api/user/reading-lists/00000000-0000-0000-0000-000000000001")
[[ "$code" == "404" || "$code" == "403" ]] || fail "idor list $code"

echo "=== ADMIN USERS PRIVACY ==="
admin_html=$(curl -sS $AUTH_NGX -b "$CJ" "$BASE/admin/users")
echo "$admin_html" | grep -qi 'Kayıt:' || fail "admin summary"
echo "$admin_html" | grep -qi 'reading_list_items' && fail "admin leak lists"
echo "$admin_html" | grep -qi 'Faz6B Beta List' && fail "admin leak list name"
echo "$admin_html" | grep -qi 'turkiyede-buyuksehir' && fail "admin leak article title"

echo "FAZ6B_BETA_SMOKE_OK"

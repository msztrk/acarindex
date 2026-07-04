#!/usr/bin/env bash
# faz-b-beta-e2e-journal-flow.sh — full journal application + publish E2E on beta.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

CRED="${ACAR_ADMIN_CRED:-/root/.faz6a-admin-credentials}"
BASE="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"
NGX_USER=""
NGX_PASS=""
CJ=""
OTHER_CJ=""
PASS=0
FAIL=0
APP_ID=""
JOURNAL_ID=""
JOURNAL_SLUG=""
UNIQUE_TITLE=""

cleanup() {
  if [[ -n "$NGX_USER" ]]; then
    htpasswd -D /etc/nginx/.htpasswd-acarindex-beta "$NGX_USER" 2>/dev/null || true
  fi
  rm -f "$CJ" "$OTHER_CJ" /tmp/fazb-e2e-*.json /tmp/fazb-e2e-cover.png
}
trap cleanup EXIT

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1" >&2; FAIL=$((FAIL + 1)); }

fetch_csrf() {
  curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p'
}

admin_patch() {
  local action="$1" note="${2:-}"
  local csrf
  csrf=$(fetch_csrf)
  curl -sS -b "$CJ" -c "$CJ" -X PATCH "$BASE/api/admin/applications/journal/$APP_ID" \
    -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
    -d "{\"action\":\"$action\",\"note\":\"$note\"}"
}

acar_beta_require_pilot
CJ="/tmp/fazb-e2e-$$.cj"
OTHER_CJ="/tmp/fazb-e2e-other-$$.cj"
EMAIL=$(grep '^email=' "$CRED" | cut -d= -f2- | tr -d '\r')
PASSWD=$(grep '^pass=' "$CRED" | cut -d= -f2- | tr -d '\r')
TEST_EMAIL=$(grep '^ACAR_BETA_MAIL_TEST_EMAIL=' /etc/acarindex/pilot.env | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
UNIQUE_TITLE="Faz B E2E $(date +%s)"
UNIQUE_SLUG="faz-b-e2e-$(date +%s)"

NGX_USER="fazb_e2e_$(date +%s)"
NGX_PASS=$(openssl rand -base64 12 | tr -d '/+=' | head -c 12)
htpasswd -bB /etc/nginx/.htpasswd-acarindex-beta "$NGX_USER" "$NGX_PASS" 2>/dev/null
AUTH_NGX="-u ${NGX_USER}:${NGX_PASS}"

csrf=$(fetch_csrf)
curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWD\"}" -o /dev/null
grep -q acarindex_session "$CJ" && pass "admin login" || fail "admin login"

echo "=== E2E STEP 1 member create ==="
csrf=$(fetch_csrf)
create_json=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/applications/journal" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf")
APP_ID=$(echo "$create_json" | sed -n 's/.*"contentApplicationId":"\([^"]*\)".*/\1/p')
[[ -n "$APP_ID" ]] && pass "create app $APP_ID" || fail "create app"

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
CAT_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT id FROM categories ORDER BY id LIMIT 1;" | tr -d ' \r\n')
csrf=$(fetch_csrf)
curl -sS -b "$CJ" -c "$CJ" -X PATCH "$BASE/api/applications/journal/$APP_ID" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{
    \"journal\": {
      \"nameTr\": \"$UNIQUE_TITLE\",
      \"pIssn\": \"2148-6797\",
      \"firstPublicationYear\": 2021,
      \"publicationFrequency\": \"quarterly\",
      \"publicationMonths\": [1,4,7,10],
      \"editorName\": \"E2E Editör\",
      \"editorEmail\": \"${TEST_EMAIL:-$EMAIL}\",
      \"websiteUrl\": \"https://example.com/$UNIQUE_SLUG\",
      \"keywords\": [\"e2e\",\"fazb\"]
    },
    \"subjectAreas\": [{\"categoryId\": $CAT_ID, \"level\": \"primary\"}],
    \"declarationAcceptance\": {
      \"criteriaAcceptedAt\": \"$NOW\",
      \"standardsAcceptedAt\": \"$NOW\",
      \"privacyNoticeAcceptedAt\": \"$NOW\",
      \"imageRightsAcceptedAt\": \"$NOW\",
      \"informationAccuracyConfirmedAt\": \"$NOW\"
    },
    \"privateContact\": {\"contactName\": \"E2E\", \"contactEmail\": \"${TEST_EMAIL:-$EMAIL}\", \"workPhone\": \"+905551112233\"}
  }" -o /dev/null

printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xdb\x00\x00\x00\x00IEND\xaeB`\x82' > /tmp/fazb-e2e-cover.png
csrf=$(fetch_csrf)
curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/applications/$APP_ID/attachments" \
  -H "x-csrf-token: $csrf" \
  -F "kind=cover_image" -F "file=@/tmp/fazb-e2e-cover.png;type=image/png" -o /dev/null

csrf=$(fetch_csrf)
submit_code=$(curl -sS -b "$CJ" -c "$CJ" -o /tmp/fazb-e2e-submit.json -w '%{http_code}' \
  -X POST "$BASE/api/applications/journal/$APP_ID/submit" -H "x-csrf-token: $csrf")
[[ "$submit_code" == "200" ]] && pass "submit" || fail "submit $submit_code"

echo "=== E2E STEP 2 admin revision ==="
admin_patch request_revision "E2E revision note" >/dev/null
REVS=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM application_revisions WHERE application_id='$APP_ID';" | tr -d ' \r\n')
[[ "$REVS" -ge 1 ]] && pass "revision count=$REVS" || fail "revision"

echo "=== E2E STEP 3 member resubmit ==="
csrf=$(fetch_csrf)
curl -sS -b "$CJ" -c "$CJ" -X PATCH "$BASE/api/applications/journal/$APP_ID" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"journal\":{\"editorName\":\"E2E Editör Rev2\"}}" -o /dev/null
csrf=$(fetch_csrf)
resubmit=$(curl -sS -b "$CJ" -c "$CJ" -o /tmp/fazb-e2e-resubmit.json -w '%{http_code}' \
  -X POST "$BASE/api/applications/journal/$APP_ID/submit" -H "x-csrf-token: $csrf")
[[ "$resubmit" == "200" ]] && pass "resubmit" || fail "resubmit $resubmit"

echo "=== E2E STEP 4 admin approve ==="
admin_patch under_review "" >/dev/null
approve_json=$(admin_patch approve "E2E approve")
JOURNAL_ID=$(echo "$approve_json" | sed -n 's/.*"approvedJournalId":"\?\([0-9][0-9]*\)"\?.*/\1/p')
JOURNAL_ID=${JOURNAL_ID:-$(echo "$approve_json" | sed -n 's/.*"id":"\([0-9][0-9]*\)".*/\1/p' | head -1)}
JOURNAL_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT approved_journal_id FROM content_applications WHERE id='$APP_ID';" | tr -d ' \r\n')
[[ -n "$JOURNAL_ID" ]] && pass "approved journal $JOURNAL_ID" || fail "approve journal"

J_STATUS=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT status FROM journals WHERE id=$JOURNAL_ID;" | tr -d ' \r\n')
[[ "$J_STATUS" == "draft" ]] && pass "draft journal status" || fail "journal status $J_STATUS"

MEM=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM journal_memberships WHERE journal_id=$JOURNAL_ID;" | tr -d ' \r\n')
[[ "$MEM" -eq 0 ]] && pass "no JournalMembership" || fail "membership count $MEM"

echo "=== E2E STEP 5 idempotent second approve ==="
admin_patch approve "" >/tmp/fazb-e2e-idem.json
J2=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT approved_journal_id FROM content_applications WHERE id='$APP_ID';" | tr -d ' \r\n')
[[ "$J2" == "$JOURNAL_ID" ]] && pass "idempotent approve" || fail "idempotent approve"

echo "=== SECURITY second user 403 ==="
OTHER_EMAIL="fazb_e2e_other_$(date +%s)@beta.local"
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -v ON_ERROR_STOP=1 <<EOSQL
WITH admin_cred AS (
  SELECT password_hash FROM user_credentials uc
  JOIN users u ON u.id = uc.user_id WHERE u.email = '$EMAIL' LIMIT 1
),
ins AS (
  INSERT INTO users (email, email_verified, status)
  VALUES ('$OTHER_EMAIL', NOW(), 'active')
  RETURNING id
)
INSERT INTO user_credentials (user_id, password_hash)
SELECT ins.id, admin_cred.password_hash FROM ins, admin_cred;
EOSQL
other_csrf=$(curl -sS -b "$OTHER_CJ" -c "$OTHER_CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')
curl -sS -b "$OTHER_CJ" -c "$OTHER_CJ" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" -H "x-csrf-token: $other_csrf" \
  -d "{\"email\":\"$OTHER_EMAIL\",\"password\":\"$PASSWD\"}" -o /dev/null
code=$(curl -sS $AUTH_NGX -b "$OTHER_CJ" -o /dev/null -w '%{http_code}' "$BASE/api/applications/$APP_ID")
[[ "$code" == "403" ]] && pass "cross-user app 403" || fail "cross-user app $code"
ATT_ID=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT id FROM application_attachments WHERE application_id='$APP_ID' LIMIT 1;" | tr -d ' \r\n')
code=$(curl -sS $AUTH_NGX -b "$OTHER_CJ" -o /dev/null -w '%{http_code}' \
  "$BASE/api/applications/$APP_ID/attachments/$ATT_ID/download")
[[ "$code" == "403" ]] && pass "cross-user attachment 403" || fail "cross-user attachment $code"
code=$(curl -sS -b "$OTHER_CJ" -c "$OTHER_CJ" -o /dev/null -w '%{http_code}' \
  -X DELETE "$BASE/api/applications/$APP_ID/attachments/$ATT_ID")
[[ "$code" == "403" ]] && pass "csrf/delete blocked for other" || fail "other delete $code"

echo "=== DRAFT PUBLIC VISIBILITY (5.5) ==="
JOURNAL_SLUG=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT slug FROM journals WHERE id=$JOURNAL_ID;" | tr -d ' \r\n')
list_body=$(curl -sS $AUTH_NGX "$BASE/journals" 2>/dev/null || true)
echo "$list_body" | grep -q "$UNIQUE_TITLE" && fail "draft in /journals" || pass "draft not in /journals"
search_body=$(curl -sS $AUTH_NGX "$BASE/search?q=$(printf '%s' "$UNIQUE_TITLE" | sed 's/ /+/g')" 2>/dev/null || true)
echo "$search_body" | grep -q "$UNIQUE_TITLE" && fail "draft in search" || pass "draft not in search"
sitemap=$(curl -sS $AUTH_NGX "$BASE/sitemap-journals" 2>/dev/null || true)
echo "$sitemap" | grep -q "$JOURNAL_SLUG" && fail "draft in sitemap-journals" || pass "draft not in sitemap"
suggest=$(curl -sS $AUTH_NGX "$BASE/api/search-suggest?q=$(printf '%s' "$UNIQUE_TITLE" | head -c 20 | sed 's/ /+/g')" 2>/dev/null || true)
echo "$suggest" | grep -q "$UNIQUE_TITLE" && fail "draft in autocomplete" || pass "draft not in autocomplete"
PUB_COUNT=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM journals WHERE status='published';" | tr -d ' \r\n')
stats=$(curl -sS $AUTH_NGX "$BASE/api/stats" 2>/dev/null || curl -sS $AUTH_NGX "$BASE/" 2>/dev/null || true)
echo "$stats" | grep -q "$UNIQUE_TITLE" && fail "draft in stats/home" || pass "draft not in stats/home"

echo "=== ADMIN PUBLISH E2E (6) ==="
csrf=$(fetch_csrf)
pub_code=$(curl -sS -b "$CJ" -c "$CJ" -o /tmp/fazb-e2e-publish.json -w '%{http_code}' \
  -X POST "$BASE/api/admin/journals/$JOURNAL_ID/publish" \
  -H "x-csrf-token: $csrf")
[[ "$pub_code" == "200" ]] && pass "publish API" || fail "publish API $pub_code $(cat /tmp/fazb-e2e-publish.json)"
PUB_STATUS=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT status FROM journals WHERE id=$JOURNAL_ID;" | tr -d ' \r\n')
[[ "$PUB_STATUS" == "published" ]] && pass "published status" || fail "published status $PUB_STATUS"
list_after=$(curl -sS $AUTH_NGX "$BASE/journals?q=$(printf '%s' "$UNIQUE_TITLE" | sed 's/ /+/g')" 2>/dev/null || true)
echo "$list_after" | grep -q "$UNIQUE_TITLE" && pass "published in catalog" || fail "published not in catalog"
sitemap_after=$(curl -sS $AUTH_NGX "$BASE/sitemap-journals" 2>/dev/null || true)
echo "$sitemap_after" | grep -q "$JOURNAL_SLUG" && pass "published in sitemap" || fail "published not in sitemap"

EVTS=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM application_events WHERE application_id='$APP_ID';" | tr -d ' \r\n')
AUD=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT count(*) FROM audit_logs WHERE entity_type='content_application' AND entity_id='$APP_ID';" | tr -d ' \r\n')

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "DELETE FROM users WHERE email = '$OTHER_EMAIL';" >/dev/null 2>&1 || true

echo "=== RECORD ==="
echo "APPLICATION_ID=$APP_ID"
echo "JOURNAL_ID=$JOURNAL_ID"
echo "JOURNAL_SLUG=$JOURNAL_SLUG"
echo "REVISION_COUNT=$REVS"
echo "EVENT_COUNT=$EVTS"
echo "AUDIT_COUNT=$AUD"
echo "MEMBERSHIP_COUNT=$MEM"
echo "PUBLISHED_JOURNALS=$PUB_COUNT"

echo "=== SUMMARY pass=$PASS fail=$FAIL ==="
[[ "$FAIL" -eq 0 ]] && echo "OK: faz-b-beta-e2e-journal-flow passed" && exit 0
exit 1

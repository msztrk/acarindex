#!/usr/bin/env bash
# faz-b-beta-outbox-email.sh — real Resend outbox delivery + retry on beta.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

CRED="${ACAR_ADMIN_CRED:-/root/.faz6a-admin-credentials}"
BASE="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"
PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
LOG="/var/log/acarindex-outbox.log"
CJ=""
PASS=0
FAIL=0
TEST_APP=""

cleanup() { rm -f "$CJ"; }
trap cleanup EXIT

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1" >&2; FAIL=$((FAIL + 1)); }

fetch_csrf() {
  curl -sS -b "$CJ" -c "$CJ" "$BASE/api/auth/csrf" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p'
}

write_fazb_journal_draft_json() {
  local title="${1:-Faz B Outbox Test Dergi $(date +%s)}"
  local slug="${2:-fazb-outbox-$(date +%s)}"
  NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  TEST_ISSN=$(acar_beta_generate_test_issn)
  cat > /tmp/fazb-journal-draft.json <<EOF
{
  "journal": {
    "nameTr": "$title",
    "pIssn": "$TEST_ISSN",
    "firstPublicationYear": 2020,
    "publicationFrequency": "quarterly",
    "publicationMonths": [1,4,7,10],
    "proposedInstitutionName": "Faz B Test Yayıncı",
    "editorName": "Test Editör",
    "editorEmail": "$TEST_EMAIL",
    "websiteUrl": "https://example.com/$slug",
    "keywords": ["test","fazb","outbox"]
  },
  "subjectAreas": [{"categoryId": 1, "level": "primary"}],
  "declarationAcceptance": {
    "criteriaAcceptedAt": "$NOW",
    "standardsAcceptedAt": "$NOW",
    "privacyNoticeAcceptedAt": "$NOW",
    "imageRightsAcceptedAt": "$NOW",
    "informationAccuracyConfirmedAt": "$NOW"
  },
  "privateContact": {"contactName": "Test", "contactEmail": "$TEST_EMAIL", "workPhone": "+905551112233"}
}
EOF
}

submit_journal_app_with_cover() {
  local app_id="$1"
  local csrf
  csrf=$(fetch_csrf)
  curl -sS -b "$CJ" -c "$CJ" -X PATCH "$BASE/api/applications/journal/$app_id" \
    -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
    -d @/tmp/fazb-journal-draft.json -o /dev/null
  csrf=$(fetch_csrf)
  curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/applications/$app_id/attachments" \
    -H "x-csrf-token: $csrf" \
    -F "kind=cover_image" -F "file=@/tmp/fazb-cover.png;type=image/png" -o /dev/null
  csrf=$(fetch_csrf)
  curl -sS -b "$CJ" -c "$CJ" -o "/tmp/fazb-submit-$app_id.json" -w '%{http_code}' \
    -X POST "$BASE/api/applications/journal/$app_id/submit" -H "x-csrf-token: $csrf"
}

acar_beta_require_pilot
CJ="/tmp/fazb-outbox-$$.cj"

echo "=== OUTBOX ENV AUDIT ==="
bash "$SCRIPT_DIR/verify-pilot-resend-env.sh" "$PILOT_ENV" | grep -v RESEND_API_KEY
grep -q '^RESEND_API_KEY=.' "$PILOT_ENV" && pass "RESEND_API_KEY set" || fail "RESEND_API_KEY missing"
TEST_EMAIL=$(grep '^ACAR_BETA_MAIL_TEST_EMAIL=' "$PILOT_ENV" | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
[[ -n "$TEST_EMAIL" ]] && pass "test email configured" || fail "ACAR_BETA_MAIL_TEST_EMAIL missing"

echo "=== CRON AUDIT ==="
crontab -l 2>/dev/null | grep -q acarindex-pilot-notification-outbox && pass "outbox cron" || fail "outbox cron missing"

echo "=== LOGROTATE ==="
if [[ -f /etc/logrotate.d/acarindex-outbox ]]; then
  pass "logrotate installed"
else
  fail "logrotate missing (install deploy/logrotate/acarindex-outbox)"
fi

EMAIL=$(grep '^email=' "$CRED" | cut -d= -f2- | tr -d '\r')
PASSWD=$(grep '^pass=' "$CRED" | cut -d= -f2- | tr -d '\r')
csrf=$(fetch_csrf)
curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWD\"}" -o /dev/null

echo "=== CREATE TEST APPLICATION ==="
csrf=$(fetch_csrf)
create_json=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/applications/journal" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf")
TEST_APP=$(echo "$create_json" | sed -n 's/.*"contentApplicationId":"\([^"]*\)".*/\1/p')
[[ -n "$TEST_APP" ]] && pass "test app $TEST_APP" || fail "test app create"

write_fazb_journal_draft_json "Faz B Outbox Test Dergi $(date +%s)" "fazb-outbox-$(date +%s)"

csrf=$(fetch_csrf)
curl -sS -b "$CJ" -c "$CJ" -X PATCH "$BASE/api/applications/journal/$TEST_APP" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
  -d @/tmp/fazb-journal-draft.json -o /dev/null

printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xdb\x00\x00\x00\x00IEND\xaeB`\x82' > /tmp/fazb-cover.png
csrf=$(fetch_csrf)
curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/applications/$TEST_APP/attachments" \
  -H "x-csrf-token: $csrf" \
  -F "kind=cover_image" -F "file=@/tmp/fazb-cover.png;type=image/png" -o /dev/null

csrf=$(fetch_csrf)
submit_code=$(curl -sS -b "$CJ" -c "$CJ" -o /tmp/fazb-submit.json -w '%{http_code}' \
  -X POST "$BASE/api/applications/journal/$TEST_APP/submit" -H "x-csrf-token: $csrf")
[[ "$submit_code" == "200" ]] && pass "journal submit" || fail "journal submit $submit_code $(cat /tmp/fazb-submit.json)"

trigger_action_for() {
  local app_id="$1" action="$2" note="$3"
  local csrf
  csrf=$(fetch_csrf)
  curl -sS -b "$CJ" -c "$CJ" -X PATCH "$BASE/api/admin/applications/journal/$app_id" \
    -H "Content-Type: application/json" -H "x-csrf-token: $csrf" \
    -d "{\"action\":\"$action\",\"note\":\"$note\"}" -o /dev/null
}

echo "=== TRIGGER revision_requested ==="
trigger_action_for "$TEST_APP" request_revision "Faz B outbox revision test"
sleep 1
$ACAR_COMPOSE --profile tools run --rm --no-deps etl scripts/process-notification-outbox.ts 20
STATUS=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT status FROM notification_outbox WHERE type='journal_application.revision_requested' AND payload->>'contentApplicationId'='$TEST_APP' ORDER BY created_at DESC LIMIT 1;" | tr -d ' \r\n')
[[ "$STATUS" == "sent" ]] && pass "revision email sent" || fail "revision email status=$STATUS"

echo "=== TRIGGER rejected (new app) ==="
csrf=$(fetch_csrf)
rej_json=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/applications/journal" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf")
REJ_APP=$(echo "$rej_json" | sed -n 's/.*"contentApplicationId":"\([^"]*\)".*/\1/p')
write_fazb_journal_draft_json "Faz B Outbox Reject $(date +%s)" "fazb-reject-$(date +%s)"
submit_code=$(submit_journal_app_with_cover "$REJ_APP")
[[ "$submit_code" == "200" ]] || fail "reject app submit $submit_code $(cat "/tmp/fazb-submit-$REJ_APP.json" 2>/dev/null)"
trigger_action_for "$REJ_APP" reject "Faz B outbox reject test"
$ACAR_COMPOSE --profile tools run --rm --no-deps etl scripts/process-notification-outbox.ts 20
STATUS=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT status FROM notification_outbox WHERE type='journal_application.rejected' AND payload->>'contentApplicationId'='$REJ_APP' ORDER BY created_at DESC LIMIT 1;" | tr -d ' \r\n')
[[ "$STATUS" == "sent" ]] && pass "reject email sent" || fail "reject email status=$STATUS"

echo "=== TRIGGER approved ==="
csrf=$(fetch_csrf)
ap_json=$(curl -sS -b "$CJ" -c "$CJ" -X POST "$BASE/api/applications/journal" \
  -H "Content-Type: application/json" -H "x-csrf-token: $csrf")
AP_APP=$(echo "$ap_json" | sed -n 's/.*"contentApplicationId":"\([^"]*\)".*/\1/p')
write_fazb_journal_draft_json "Faz B Outbox Approve $(date +%s)" "fazb-approve-$(date +%s)"
submit_code=$(submit_journal_app_with_cover "$AP_APP")
[[ "$submit_code" == "200" ]] || fail "approve app submit $submit_code $(cat "/tmp/fazb-submit-$AP_APP.json" 2>/dev/null)"
trigger_action_for "$AP_APP" under_review ""
trigger_action_for "$AP_APP" approve "Faz B outbox approve test"
$ACAR_COMPOSE --profile tools run --rm --no-deps etl scripts/process-notification-outbox.ts 20
STATUS=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT status FROM notification_outbox WHERE type='journal_application.approved' AND payload->>'contentApplicationId'='$AP_APP' ORDER BY created_at DESC LIMIT 1;" | tr -d ' \r\n')
[[ "$STATUS" == "sent" ]] && pass "approve email sent" || fail "approve email status=$STATUS"

echo "=== RETRY TEST invalid recipient ==="
INVALID_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)
$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -v ON_ERROR_STOP=1 <<EOSQL
INSERT INTO notification_outbox (id, type, recipient, payload, status, attempt_count, created_at, updated_at)
VALUES ('$INVALID_ID', 'journal_application.revision_requested', 'not-an-email', '{"title":"Retry test"}'::jsonb, 'pending', 0, NOW(), NOW());
EOSQL
$ACAR_COMPOSE --profile tools run --rm --no-deps etl scripts/process-notification-outbox.ts 5
RETRY_STATUS=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT status FROM notification_outbox WHERE id='$INVALID_ID';" | tr -d ' \r\n')
[[ "$RETRY_STATUS" == "failed" || "$RETRY_STATUS" == "pending" ]] && pass "invalid recipient handled ($RETRY_STATUS)" || fail "invalid recipient $RETRY_STATUS"

$ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -c \
  "UPDATE notification_outbox SET recipient='$TEST_EMAIL', status='pending', last_error=NULL WHERE id='$INVALID_ID';"
$ACAR_COMPOSE --profile tools run --rm --no-deps etl scripts/process-notification-outbox.ts 5
RETRY_OK=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
  "SELECT status FROM notification_outbox WHERE id='$INVALID_ID';" | tr -d ' \r\n')
[[ "$RETRY_OK" == "sent" ]] && pass "retry after fix sent" || fail "retry after fix $RETRY_OK"

echo "=== LOG SECRET GREP ==="
if [[ -f "$LOG" ]]; then
  if grep -E 'RESEND_API_KEY|re_[A-Za-z0-9]{10,}|B2_.*KEY' "$LOG" >/dev/null 2>&1; then
    fail "secrets found in outbox log"
  else
    pass "no secrets in outbox log"
  fi
else
  pass "outbox log not yet created"
fi

echo "=== SUMMARY pass=$PASS fail=$FAIL test_email=$TEST_EMAIL ==="
[[ "$FAIL" -eq 0 ]] && echo "OK: faz-b-beta-outbox-email passed" && exit 0
exit 1

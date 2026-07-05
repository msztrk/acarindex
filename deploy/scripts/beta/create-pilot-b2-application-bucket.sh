#!/usr/bin/env bash
# create-pilot-b2-application-bucket.sh — create private bucket if missing (idempotent).
set -Eeuo pipefail

PILOT_ENV="${1:-/etc/acarindex/pilot.env}"
BUCKET="${2:-acarindex-applications-pilot}"

KEY_ID=$(grep '^B2_APPLICATION_KEY_ID=' "$PILOT_ENV" | cut -d= -f2- | tr -d '\r')
KEY=$(grep '^B2_APPLICATION_KEY=' "$PILOT_ENV" | cut -d= -f2- | tr -d '\r')
[[ -n "$KEY_ID" && -n "$KEY" ]] || { echo "FAIL: B2_APPLICATION_* missing"; exit 1; }

AUTH_JSON=$(curl -sS -u "${KEY_ID}:${KEY}" https://api.backblazeb2.com/b2api/v2/b2_authorize_account)
ACCOUNT=$(printf '%s' "$AUTH_JSON" | sed -n 's/.*"accountId":"\([^"]*\)".*/\1/p')
TOKEN=$(printf '%s' "$AUTH_JSON" | sed -n 's/.*"authorizationToken":"\([^"]*\)".*/\1/p')
API=$(printf '%s' "$AUTH_JSON" | sed -n 's/.*"apiUrl":"\([^"]*\)".*/\1/p')
[[ -n "$ACCOUNT" && -n "$TOKEN" && -n "$API" ]] || { echo "FAIL: B2 authorize"; exit 1; }

LIST=$(curl -sS -X POST "${API}/b2api/v2/b2_list_buckets" \
  -H "Authorization: ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"accountId\":\"${ACCOUNT}\",\"bucketName\":\"${BUCKET}\"}")

if printf '%s' "$LIST" | grep -q "\"bucketName\":\"${BUCKET}\""; then
  echo "BUCKET_EXISTS=${BUCKET}"
  exit 0
fi

CREATE=$(curl -sS -w '\nHTTP=%{http_code}' -X POST "${API}/b2api/v2/b2_create_bucket" \
  -H "Authorization: ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"accountId\":\"${ACCOUNT}\",\"bucketName\":\"${BUCKET}\",\"bucketType\":\"allPrivate\"}")

echo "$CREATE" | tail -3
if printf '%s' "$CREATE" | grep -q "\"bucketName\":\"${BUCKET}\""; then
  echo "BUCKET_CREATED=${BUCKET}"
  exit 0
fi

echo "FAIL: could not create bucket (key may lack createBucket or bucket name restricted)" >&2
exit 1

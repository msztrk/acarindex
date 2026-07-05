#!/usr/bin/env bash
# list-b2-buckets.sh — list bucket names for B2_APPLICATION_* in pilot.env (no secrets printed).
set -Eeuo pipefail

PILOT_ENV="${1:-/etc/acarindex/pilot.env}"
KEY_ID=$(grep '^B2_APPLICATION_KEY_ID=' "$PILOT_ENV" | cut -d= -f2- | tr -d '\r')
KEY=$(grep '^B2_APPLICATION_KEY=' "$PILOT_ENV" | cut -d= -f2- | tr -d '\r')
[[ -n "$KEY_ID" && -n "$KEY" ]] || { echo "FAIL: B2_APPLICATION_* missing"; exit 1; }

AUTH=$(curl -sS -u "${KEY_ID}:${KEY}" https://api.backblazeb2.com/b2api/v2/b2_authorize_account)
ACCOUNT=$(echo "$AUTH" | sed -n 's/.*"accountId":"\([^"]*\)".*/\1/p')
TOKEN=$(echo "$AUTH" | sed -n 's/.*"authorizationToken":"\([^"]*\)".*/\1/p')
API=$(echo "$AUTH" | sed -n 's/.*"apiUrl":"\([^"]*\)".*/\1/p')
[[ -n "$ACCOUNT" && -n "$TOKEN" && -n "$API" ]] || { echo "FAIL: B2 authorize"; exit 1; }

BODY=$(curl -sS -X POST "${API}/b2api/v2/b2_list_buckets" \
  -H "Authorization: ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"accountId\":\"${ACCOUNT}\",\"bucketTypes\":[\"allPrivate\",\"allPublic\"]}")

echo "$BODY" | grep -o '"bucketName":"[^"]*"' | sed 's/"bucketName":"//;s/"$//' | while read -r name; do
  echo "BUCKET=$name"
done

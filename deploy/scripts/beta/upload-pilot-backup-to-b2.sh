#!/usr/bin/env bash
# upload-pilot-backup-to-b2.sh — upload verified pilot pg_dump to B2 backup bucket.
# Requires B2_BACKUP_KEY_ID, B2_BACKUP_KEY, B2_BACKUP_BUCKET in pilot.env or env.
# Never logs secrets.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

PILOT_ENV="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"
DUMP="${1:-}"
SHA256="${2:-}"

read_env_file_val() {
  local file="$1" key="$2"
  grep "^${key}=" "$file" 2>/dev/null | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//'
}

redact() {
  sed -E \
    -e 's/(B2_BACKUP_KEY_ID|B2_BACKUP_KEY|Authorization: Basic [^[:space:]]+)/[REDACTED]/g' \
    -e 's/[A-Za-z0-9]{25,}/[REDACTED]/g'
}

b2_authorize() {
  local key_id="$1" key="$2"
  local api="${B2_BACKUP_ENDPOINT:-https://api.backblaze.com}"
  api="${api%/}"
  local auth
  auth=$(curl -sf "${api}/b2api/v2/b2_authorize_account" \
    -H "Authorization: Basic $(printf '%s:%s' "$key_id" "$key" | base64 -w0 2>/dev/null || printf '%s:%s' "$key_id" "$key" | base64)") || return 1
  B2_AUTH_JSON="$auth"
  B2_API_URL=$(echo "$auth" | sed -n 's/.*"apiUrl"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
  B2_AUTH_TOKEN=$(echo "$auth" | sed -n 's/.*"authorizationToken"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
  B2_DOWNLOAD_URL=$(echo "$auth" | sed -n 's/.*"downloadUrl"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
  [[ -n "$B2_API_URL" && -n "$B2_AUTH_TOKEN" ]]
}

b2_get_bucket_id() {
  local bucket_name="$1"
  local resp
  resp=$(curl -sf "$B2_API_URL/b2api/v2/b2_list_buckets" \
    -H "Authorization: $B2_AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"accountId\":\"$(echo "$B2_AUTH_JSON" | sed -n 's/.*"accountId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')\",\"bucketName\":\"$bucket_name\"}") || return 1
  B2_BUCKET_ID=$(echo "$resp" | sed -n 's/.*"bucketId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
  [[ -n "$B2_BUCKET_ID" ]]
}

b2_upload_file() {
  local local_file="$1" remote_name="$2" sha256="$3"
  local up_resp up_url up_auth
  up_resp=$(curl -sf "$B2_API_URL/b2api/v2/b2_get_upload_url" \
    -H "Authorization: $B2_AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"bucketId\":\"$B2_BUCKET_ID\"}") || return 1
  up_url=$(echo "$up_resp" | sed -n 's/.*"uploadUrl"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
  up_auth=$(echo "$up_resp" | sed -n 's/.*"authorizationToken"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
  local size
  size=$(stat -c%s "$local_file" 2>/dev/null || stat -f%z "$local_file")
  curl -sf "$up_url" \
    -H "Authorization: $up_auth" \
    -H "X-Bz-File-Name: $(printf '%s' "$remote_name" | jq -sRr @uri 2>/dev/null || python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$remote_name")" \
    -H "Content-Type: application/octet-stream" \
    -H "X-Bz-Content-Sha1: do_not_verify" \
    -H "X-Bz-Info-sha256: $sha256" \
    --data-binary @"$local_file" >/dev/null
}

b2_download_file() {
  local remote_name="$1" dest="$2"
  curl -sf "$B2_DOWNLOAD_URL/file/${B2_BUCKET}/${remote_name}" \
    -H "Authorization: $B2_AUTH_TOKEN" \
    -o "$dest"
}

b2_list_milestone_dumps() {
  local resp start=""
  while :; do
    local payload="{\"bucketId\":\"$B2_BUCKET_ID\",\"prefix\":\"pilot_pg_pre_\",\"maxFileCount\":1000"
    [[ -n "$start" ]] && payload="${payload},\"startFileName\":\"$start\""
    payload="${payload}}"
    resp=$(curl -sf "$B2_API_URL/b2api/v2/b2_list_file_names" \
      -H "Authorization: $B2_AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$payload") || return 1
    echo "$resp" | sed -n 's/.*"fileName"[[:space:]]*:[[:space:]]*"\(pilot_pg_pre_[^"]*\.dump\)".*/\1/p'
    start=$(echo "$resp" | sed -n 's/.*"nextFileName"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    [[ -n "$start" ]] || break
  done
}

b2_delete_file_version() {
  local name="$1" file_id="$2"
  curl -sf "$B2_API_URL/b2api/v2/b2_delete_file_version" \
    -H "Authorization: $B2_AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"fileName\":\"$name\",\"fileId\":\"$file_id\"}" >/dev/null
}

apply_b2_retention() {
  local keep="${B2_BACKUP_KEEP_MILESTONE:-5}"
  mapfile -t FILES < <(b2_list_milestone_dumps | sort -r)
  if [[ ${#FILES[@]} -le $keep ]]; then
    echo "B2_RETENTION_OK count=${#FILES[@]}"
    return 0
  fi
  for ((i = keep; i < ${#FILES[@]}; i++)); do
    local name="${FILES[$i]}"
    local info
    info=$(curl -sf "$B2_API_URL/b2api/v2/b2_list_file_names" \
      -H "Authorization: $B2_AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"bucketId\":\"$B2_BUCKET_ID\",\"prefix\":\"$name\",\"maxFileCount\":1}") || continue
    local fid
    fid=$(echo "$info" | sed -n 's/.*"fileId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
    [[ -n "$fid" ]] && b2_delete_file_version "$name" "$fid" && rm -f "${name}.sha256" 2>/dev/null || true
    echo "B2_RETENTION_REMOVED=$name"
  done
  echo "B2_RETENTION_OK"
}

[[ -f "$PILOT_ENV" ]] || { echo "FAIL: missing pilot env" >&2; exit 1; }
[[ -f "$DUMP" ]] || { echo "FAIL: dump not found: $DUMP" >&2; exit 1; }

KEY_ID=$(read_env_file_val "$PILOT_ENV" B2_BACKUP_KEY_ID)
KEY=$(read_env_file_val "$PILOT_ENV" B2_BACKUP_KEY)
BUCKET=$(read_env_file_val "$PILOT_ENV" B2_BACKUP_BUCKET)
BUCKET="${BUCKET:-acarindex-backups-pilot}"

if [[ -z "$KEY_ID" || -z "$KEY" ]]; then
  echo "B2_BACKUP_UPLOAD_SKIPPED=missing_credentials"
  exit 0
fi

if [[ -z "$SHA256" ]]; then
  SHA256=$(sha256sum "$DUMP" | awk '{print $1}')
fi

REMOTE_NAME="$(basename "$DUMP")"

if ! b2_authorize "$KEY_ID" "$KEY"; then
  echo "FAIL: B2 authorize failed" >&2
  exit 1
fi
if ! b2_get_bucket_id "$BUCKET"; then
  echo "FAIL: B2 bucket lookup failed for $BUCKET" >&2
  exit 1
fi

echo "=== B2 UPLOAD $REMOTE_NAME ==="
if ! b2_upload_file "$DUMP" "$REMOTE_NAME" "$SHA256"; then
  echo "FAIL: B2 upload failed" >&2
  exit 1
fi

TMP_SHA="/tmp/${REMOTE_NAME}.sha256"
printf '%s  %s\n' "$SHA256" "$REMOTE_NAME" > "$TMP_SHA"
if ! b2_upload_file "$TMP_SHA" "${REMOTE_NAME}.sha256" "$(sha256sum "$TMP_SHA" | awk '{print $1}')"; then
  echo "FAIL: B2 sidecar sha256 upload failed" >&2
  exit 1
fi
rm -f "$TMP_SHA"

apply_b2_retention || true
echo "B2_BACKUP_UPLOAD_OK remote=$REMOTE_NAME sha256=$SHA256"

# Optional restore rehearsal when REHEARSE=1
if [[ "${B2_RESTORE_REHEARSE:-0}" == "1" ]]; then
  REHEARSE_DB="acarindex_b2_rehearse_$(date +%s)"
  REHEARSE_DUMP="/tmp/${REMOTE_NAME}.rehearse"
  b2_download_file "$REMOTE_NAME" "$REHEARSE_DUMP"
  DL_SHA=$(sha256sum "$REHEARSE_DUMP" | awk '{print $1}')
  [[ "$DL_SHA" == "$SHA256" ]] || { echo "FAIL: downloaded sha mismatch"; exit 1; }
  acar_beta_require_pilot
  $ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c "CREATE DATABASE $REHEARSE_DB OWNER acarindex_pilot;"
  $ACAR_COMPOSE exec -T postgres pg_restore -U acarindex_pilot -d "$REHEARSE_DB" --no-owner --no-acl < "$REHEARSE_DUMP"
  TABLES=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d "$REHEARSE_DB" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d ' \r\n')
  echo "B2_RESTORE_REHEARSE_TABLES=$TABLES"
  $ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d postgres -c \
    "DROP DATABASE IF EXISTS $REHEARSE_DB WITH (FORCE);"
  rm -f "$REHEARSE_DUMP"
  echo "B2_RESTORE_REHEARSE_OK"
fi

#!/usr/bin/env bash
# configure-pilot-b2-storage.sh — idempotent B2 application storage setup for pilot/beta.
#
# Backblaze B2 bucket setup (one-time, Backblaze console):
#   1. Create bucket: acarindex-applications-pilot (Private)
#   2. Application Keys → Add New Application Key
#      - Name: acarindex-pilot-applications
#      - Allow access to bucket: acarindex-applications-pilot
#      - Capabilities: listBuckets, readBuckets, readFiles, writeFiles, deleteFiles
#   3. Copy keyID + applicationKey (shown once)
#   4. Export before running:
#        export B2_APPLICATION_KEY_ID='...'
#        export B2_APPLICATION_KEY='...'
#        export B2_APPLICATION_BUCKET='acarindex-applications-pilot'
#      Optional: B2_APPLICATION_ENDPOINT=https://api.backblazeb2.com
#
# Credential sources (first match wins; secrets never echoed):
#   - Runtime env: B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_APPLICATION_BUCKET
#   - Workspace .env.local (when run from dev machine; not committed)
#   - Existing /etc/acarindex/pilot.env values (re-validate only)
#
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

PILOT_ENV="${1:-/etc/acarindex/pilot.env}"
LOCAL_ENV="${2:-${ACAR_LOCAL_ENV:-}}"
ROOT="${ACAR_ROOT:-/opt/acarindex}"

if [[ -z "$LOCAL_ENV" && -f "$ROOT/.env.local" ]]; then
  LOCAL_ENV="$ROOT/.env.local"
elif [[ -z "$LOCAL_ENV" && -f "$(cd "$SCRIPT_DIR/../../.." && pwd)/.env.local" ]]; then
  LOCAL_ENV="$(cd "$SCRIPT_DIR/../../.." && pwd)/.env.local"
fi

read_env_file_val() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  if grep -qE "^${key}=.+" "$file" 2>/dev/null; then
    grep "^${key}=" "$file" | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//'
  fi
}

set_kv() {
  local key="$1"
  local val="$2"
  local esc
  esc=$(printf '%s' "$val" | sed 's/[&/\]/\\&/g')
  if grep -q "^${key}=" "$PILOT_ENV" 2>/dev/null; then
    sed -i "s/^${key}=.*/${key}=${esc}/" "$PILOT_ENV"
  else
    printf '%s=%s\n' "$key" "$val" >> "$PILOT_ENV"
  fi
}

resolve_creds() {
  B2_KEY_ID="${B2_APPLICATION_KEY_ID:-}"
  B2_KEY="${B2_APPLICATION_KEY:-}"
  B2_BUCKET="${B2_APPLICATION_BUCKET:-}"
  B2_ENDPOINT="${B2_APPLICATION_ENDPOINT:-}"

  if [[ -z "$B2_KEY_ID" && -n "$LOCAL_ENV" ]]; then
    B2_KEY_ID=$(read_env_file_val "$LOCAL_ENV" B2_APPLICATION_KEY_ID)
    [[ -z "$B2_KEY" ]] && B2_KEY=$(read_env_file_val "$LOCAL_ENV" B2_APPLICATION_KEY)
    [[ -z "$B2_BUCKET" ]] && B2_BUCKET=$(read_env_file_val "$LOCAL_ENV" B2_APPLICATION_BUCKET)
    [[ -z "$B2_ENDPOINT" ]] && B2_ENDPOINT=$(read_env_file_val "$LOCAL_ENV" B2_APPLICATION_ENDPOINT)
  fi

  if [[ -z "$B2_KEY_ID" ]]; then
    B2_KEY_ID=$(read_env_file_val "$PILOT_ENV" B2_APPLICATION_KEY_ID)
    [[ -z "$B2_KEY" ]] && B2_KEY=$(read_env_file_val "$PILOT_ENV" B2_APPLICATION_KEY)
    [[ -z "$B2_BUCKET" ]] && B2_BUCKET=$(read_env_file_val "$PILOT_ENV" B2_APPLICATION_BUCKET)
    [[ -z "$B2_ENDPOINT" ]] && B2_ENDPOINT=$(read_env_file_val "$PILOT_ENV" B2_APPLICATION_ENDPOINT)
  fi
}

ensure_memory_fallback() {
  if grep -q '^APPLICATION_STORAGE_PROVIDER=' "$PILOT_ENV" 2>/dev/null; then
    sed -i 's/^APPLICATION_STORAGE_PROVIDER=.*/APPLICATION_STORAGE_PROVIDER=memory/' "$PILOT_ENV"
  else
    echo 'APPLICATION_STORAGE_PROVIDER=memory' >> "$PILOT_ENV"
  fi
  chown root:root "$PILOT_ENV" 2>/dev/null || true
  chmod 600 "$PILOT_ENV"
  echo "B2_CONFIGURE_SKIPPED=memory (credentials absent — add B2_APPLICATION_* to pilot.env or export env vars)"
}

backup_pilot_env() {
  [[ -f "$PILOT_ENV" ]] || return 0
  local backup="${PILOT_ENV}.bak.$(date +%Y%m%d_%H%M%S)"
  cp -a "$PILOT_ENV" "$backup"
  chown root:root "$backup" 2>/dev/null || true
  chmod 600 "$backup"
  mapfile -t OLD_BACKUPS < <(ls -t "${PILOT_ENV}.bak."* 2>/dev/null || true)
  if [[ ${#OLD_BACKUPS[@]} -gt 5 ]]; then
    for ((i = 5; i < ${#OLD_BACKUPS[@]}; i++)); do
      rm -f "${OLD_BACKUPS[$i]}"
    done
  fi
  echo "PILOT_ENV_BACKUP=$backup"
}

[[ -f "$PILOT_ENV" ]] || { echo "FAIL: missing $PILOT_ENV" >&2; exit 1; }

resolve_creds

if [[ -z "$B2_KEY_ID" || -z "$B2_KEY" || -z "$B2_BUCKET" ]]; then
  ensure_memory_fallback
  exit 0
fi

backup_pilot_env

set_kv B2_APPLICATION_KEY_ID "$B2_KEY_ID"
set_kv B2_APPLICATION_KEY "$B2_KEY"
set_kv B2_APPLICATION_BUCKET "$B2_BUCKET"
if [[ -n "$B2_ENDPOINT" ]]; then
  set_kv B2_APPLICATION_ENDPOINT "$B2_ENDPOINT"
fi
set_kv APPLICATION_STORAGE_PROVIDER b2
chown root:root "$PILOT_ENV" 2>/dev/null || true
chmod 600 "$PILOT_ENV"
echo "B2_CONFIGURE_WRITTEN=ok (provider=b2, bucket name set)"

acar_beta_require_pilot
cd "$ROOT"

echo "=== B2 STORAGE PROBE ==="
PROBE_OUT=$($ACAR_COMPOSE --profile tools run --rm --no-deps etl scripts/test-b2-application-storage.ts 2>&1) || {
  echo "$PROBE_OUT" | sed -E \
    -e 's/(B2_APPLICATION_KEY_ID|B2_APPLICATION_KEY)=[^[:space:]]+/\1=[REDACTED]/g' \
    -e 's/[A-Za-z0-9]{25,}/[REDACTED]/g'
  echo "FAIL: B2 storage probe failed" >&2
  exit 1
}

echo "$PROBE_OUT" | grep -q 'b2_storage_probe_ok' || {
  echo "FAIL: B2 probe did not succeed" >&2
  exit 1
}
echo "B2_STORAGE_PROBE_OK"

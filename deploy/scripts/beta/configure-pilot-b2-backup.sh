#!/usr/bin/env bash
# configure-pilot-b2-backup.sh — idempotent B2 off-site backup credentials for pilot/beta.
#
# Credential sources (first match wins; secrets never echoed):
#   - Runtime env: B2_BACKUP_KEY_ID, B2_BACKUP_KEY, B2_BACKUP_BUCKET
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

backup_pilot_env() {
  [[ -f "$PILOT_ENV" ]] || return 0
  local backup="${PILOT_ENV}.bak.$(date +%Y%m%d_%H%M%S)"
  cp -a "$PILOT_ENV" "$backup"
  chown root:root "$backup" 2>/dev/null || true
  chmod 600 "$backup"
  echo "PILOT_ENV_BACKUP=$backup"
}

resolve_creds() {
  B2_KEY_ID="${B2_BACKUP_KEY_ID:-}"
  B2_KEY="${B2_BACKUP_KEY:-}"
  B2_BUCKET="${B2_BACKUP_BUCKET:-acarindex-backups-pilot}"
  B2_ENDPOINT="${B2_BACKUP_ENDPOINT:-}"

  if [[ -z "$B2_KEY_ID" && -n "$LOCAL_ENV" ]]; then
    B2_KEY_ID=$(read_env_file_val "$LOCAL_ENV" B2_BACKUP_KEY_ID)
    [[ -z "$B2_KEY" ]] && B2_KEY=$(read_env_file_val "$LOCAL_ENV" B2_BACKUP_KEY)
    [[ -z "$B2_BUCKET" ]] && B2_BUCKET=$(read_env_file_val "$LOCAL_ENV" B2_BACKUP_BUCKET)
    [[ -z "$B2_ENDPOINT" ]] && B2_ENDPOINT=$(read_env_file_val "$LOCAL_ENV" B2_BACKUP_ENDPOINT)
  fi

  if [[ -z "$B2_KEY_ID" ]]; then
    B2_KEY_ID=$(read_env_file_val "$PILOT_ENV" B2_BACKUP_KEY_ID)
    [[ -z "$B2_KEY" ]] && B2_KEY=$(read_env_file_val "$PILOT_ENV" B2_BACKUP_KEY)
    [[ -z "$B2_BUCKET" ]] && B2_BUCKET=$(read_env_file_val "$PILOT_ENV" B2_BACKUP_BUCKET)
    [[ -z "$B2_ENDPOINT" ]] && B2_ENDPOINT=$(read_env_file_val "$PILOT_ENV" B2_BACKUP_ENDPOINT)
  fi
}

[[ -f "$PILOT_ENV" ]] || { echo "FAIL: missing $PILOT_ENV" >&2; exit 1; }

resolve_creds

if [[ -z "$B2_KEY_ID" || -z "$B2_KEY" ]]; then
  echo "B2_BACKUP_CONFIGURE_SKIPPED=missing_credentials"
  exit 0
fi

backup_pilot_env

set_kv B2_BACKUP_KEY_ID "$B2_KEY_ID"
set_kv B2_BACKUP_KEY "$B2_KEY"
set_kv B2_BACKUP_BUCKET "${B2_BUCKET:-acarindex-backups-pilot}"
if [[ -n "$B2_ENDPOINT" ]]; then
  set_kv B2_BACKUP_ENDPOINT "$B2_ENDPOINT"
fi
chown root:root "$PILOT_ENV" 2>/dev/null || true
chmod 600 "$PILOT_ENV"
echo "B2_BACKUP_CONFIGURE_WRITTEN=ok (bucket name set)"

#!/usr/bin/env bash
# Güncelle pilot.env — RESEND_API_KEY bu scripte dahil değil
set -Eeuo pipefail

PILOT_ENV="${1:-/etc/acarindex/pilot.env}"

set_kv() {
  local key="$1"
  local val="$2"
  local esc
  esc=$(printf '%s' "$val" | sed 's/[&/\]/\\&/g')
  if grep -q "^${key}=" "$PILOT_ENV"; then
    sed -i "s/^${key}=.*/${key}=${esc}/" "$PILOT_ENV"
  else
    printf '%s=%s\n' "$key" "$val" >> "$PILOT_ENV"
  fi
}

set_kv EMAIL_PROVIDER resend
set_kv EMAIL_FROM 'AcarIndex <no-reply@notify.acarindex.com>'
set_kv EMAIL_REPLY_TO msztrk@gmail.com
set_kv APP_PUBLIC_URL https://beta.acarindex.com
set_kv ACAR_RESEND_DOMAIN_VERIFIED 1
set_kv ACAR_BETA_MAIL_TEST_EMAIL msztrk+acarindex-beta@gmail.com
set_kv ENABLE_PUBLIC_REGISTRATION 0
set_kv ENABLE_EMAIL_VERIFICATION 0
set_kv ENABLE_PASSWORD_RESET 0
set_kv ENABLE_CAPTCHA 0

chown root:root "$PILOT_ENV"
chmod 600 "$PILOT_ENV"

echo "PILOT_ENV_UPDATED"

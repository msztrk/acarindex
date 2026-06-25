#!/usr/bin/env bash
set -Eeuo pipefail
PILOT_ENV="${1:-/etc/acarindex/pilot.env}"
echo "ENV_VERIFY"
for k in EMAIL_PROVIDER EMAIL_FROM EMAIL_REPLY_TO APP_PUBLIC_URL ACAR_RESEND_DOMAIN_VERIFIED ACAR_BETA_MAIL_TEST_EMAIL ENABLE_PUBLIC_REGISTRATION ENABLE_EMAIL_VERIFICATION ENABLE_PASSWORD_RESET ENABLE_CAPTCHA; do
  if grep -q "^${k}=" "$PILOT_ENV"; then
    val=$(grep "^${k}=" "$PILOT_ENV" | cut -d= -f2- | tr -d '\r')
    echo "${k}=${val}"
  else
    echo "${k}=MISSING"
  fi
done
if grep -q '^RESEND_API_KEY=.' "$PILOT_ENV"; then echo "RESEND_API_KEY=SET"; else echo "RESEND_API_KEY=MISSING"; fi
grep '^EMAIL_FROM=' "$PILOT_ENV" | grep -q 'notify.acarindex.com' && echo "EMAIL_FROM_DOMAIN=ok" || echo "EMAIL_FROM_DOMAIN=fail"
ls -la "$PILOT_ENV"

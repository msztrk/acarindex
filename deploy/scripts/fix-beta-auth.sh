#!/usr/bin/env bash
set -euo pipefail

HTPASSWD=/etc/nginx/.htpasswd-acarindex-beta
CRED=/root/.acarindex-beta-basic-auth.txt

echo "=== current users ==="
cut -d: -f1 "$HTPASSWD"

# Simple password: no special chars that confuse browsers/copy-paste
PASS="AcarBeta2026Xk9m"

# Clean file: only acarindex_beta
printf '%s:%s\n' "acarindex_beta" "$(htpasswd -nbB acarindex_beta "$PASS" | cut -d: -f2)" > "$HTPASSWD"
chmod 640 "$HTPASSWD"
chown root:www-data "$HTPASSWD"

printf 'user=acarindex_beta\npass=%s\n' "$PASS" > "$CRED"
chmod 600 "$CRED"

nginx -t
systemctl reload nginx

echo "=== htpasswd verify ==="
htpasswd -vb "$HTPASSWD" acarindex_beta "$PASS" && echo VERIFY_OK || echo VERIFY_FAIL

NOAUTH=$(curl -sS -o /dev/null -w '%{http_code}' https://beta.acarindex.com/)
GOOD=$(curl -sS -o /dev/null -w '%{http_code}' -u "acarindex_beta:$PASS" https://beta.acarindex.com/)
BAD=$(curl -sS -o /dev/null -w '%{http_code}' -u "acarindex_beta:wrongpassword" https://beta.acarindex.com/)

echo "NOAUTH=$NOAUTH GOOD=$GOOD BAD=$BAD"
echo "USERNAME=acarindex_beta"
echo "PASSWORD=$PASS"

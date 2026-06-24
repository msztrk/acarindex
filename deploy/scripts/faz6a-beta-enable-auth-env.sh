#!/usr/bin/env bash
set -euo pipefail
# Auth flags — pilot.env only
PILOT_ENV=/etc/acarindex/pilot.env
for key in ENABLE_USER_AUTH NEXT_PUBLIC_ENABLE_USER_AUTH ENABLE_ADMIN_PANEL NEXT_PUBLIC_ENABLE_ADMIN_PANEL USE_PG_AUTH; do
  if grep -q "^${key}=" "$PILOT_ENV"; then
    sed -i "s/^${key}=.*/${key}=1/" "$PILOT_ENV"
  else
    echo "${key}=1" >> "$PILOT_ENV"
  fi
done
grep -E 'ENABLE_USER_AUTH|ENABLE_ADMIN_PANEL|USE_PG_AUTH' "$PILOT_ENV" | sed 's/PASSWORD.*//'

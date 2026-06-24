#!/usr/bin/env bash
set -euo pipefail

echo "=== BACKUP FILES ==="
for f in \
  /var/backups/acarindex-pilot/pilot_pg_pre_public_20260624_181005.dump \
  /var/backups/acarindex-beta/pre_public_20260624_181008.dump \
  /var/backups/acarindex-beta/nginx-beta.acarindex.com.20260624.conf
do
  if [[ -f "$f" && -s "$f" ]]; then
    ls -lh "$f"
    sha256sum "$f"
  else
    echo "MISSING_OR_EMPTY: $f"
    exit 1
  fi
done

echo "=== EXPECTED SHA256 ==="
echo "pilot: a341799ef44dc4508de255a90792e171558aa40b14446a332c4413b121e67bba"
echo "beta:  f6fd687825b09c1566acdf4eeba2a18b0a3397a3cadbab1175d341d52171b541"
echo "nginx: b3983e71b76255a38709d9b64d76a76dd5b425c67437f1d58954366ada8bb1bd"

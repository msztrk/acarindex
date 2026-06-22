#!/usr/bin/env bash
# PostgreSQL restore — sunucuda, bakım penceresinde
set -euo pipefail
DUMP_FILE="${1:?Usage: restore-db.sh /path/to/dump.dump}"
pg_restore --clean --if-exists -d "$DATABASE_URL" "$DUMP_FILE"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$ROOT/lib-live-source-guard.sh"
acar_dr_abort_if_pilot_target "acarindex_pilot"
DUMP="${1:?path to .sql.gz}"
CONTAINER="${ACAR_VERIFY_CONTAINER:-acarindex-live-source-verify}"
VOLUME="${ACAR_VERIFY_VOLUME:-acarindex_live_source_verify_data}"
MARIADB_IMAGE="${ACAR_VERIFY_MARIADB_IMAGE:-mariadb:10.11}"
echo "Start isolated verify: docker run --name $CONTAINER -v ${VOLUME}:/var/lib/mysql -e MARIADB_ROOT_PASSWORD=*** $MARIADB_IMAGE"
echo "Restore: gzip -dc '$DUMP' | docker exec -i $CONTAINER mariadb -u root -p"
#!/usr/bin/env bash
# Shared guards for live source backup (no beta/pilot writes).
set -euo pipefail

acar_dr_abort_if_pilot_target() {
  local target="${1:-}"
  if [[ "$target" == *"acarindex_pilot"* ]] || [[ "$target" == *"178.105.165.9"* ]] || [[ "${ACAR_SSH_HOST:-}" == "acarindex-beta" ]]; then
    echo "ABORT: refuse write/restore target on beta pilot (${target:-unset})" >&2
    exit 1
  fi
}

acar_dr_require_live_ssh() {
  local host="${ACAR_LIVE_SSH_HOST:-}"
  if [[ -z "$host" ]]; then
    echo "Set ACAR_LIVE_SSH_HOST to production SSH alias (NOT acarindex-beta)" >&2
    exit 1
  fi
  if [[ "$host" == "acarindex-beta" ]] || [[ "$host" == *"178.105.165.9"* ]]; then
    echo "ABORT: ACAR_LIVE_SSH_HOST must not be beta" >&2
    exit 1
  fi
}
#!/usr/bin/env bash
# Shared pilot-only guards for beta ops scripts (source, do not execute).
set -Eeuo pipefail

acar_beta_require_pilot() {
  local root="${ACAR_ROOT:-/opt/acarindex}"
  local compose_file="${ACAR_COMPOSE_FILE:-$root/docker-compose.pilot.yml}"
  local env_file="${ACAR_PILOT_ENV:-/etc/acarindex/pilot.env}"

  if [[ "$(basename "$compose_file")" != "docker-compose.pilot.yml" ]]; then
    echo "FAIL: compose file must be docker-compose.pilot.yml" >&2
    exit 1
  fi
  if [[ ! -f "$compose_file" ]]; then
    echo "FAIL: missing $compose_file" >&2
    exit 1
  fi
  if [[ ! -f "$env_file" ]]; then
    echo "FAIL: missing pilot env $env_file" >&2
    exit 1
  fi

  ACAR_ROOT="$root"
  ACAR_COMPOSE_FILE="$compose_file"
  ACAR_PILOT_ENV="$env_file"
  ACAR_COMPOSE="docker compose --env-file $env_file -f $compose_file"

  local pg_container
  pg_container=$($ACAR_COMPOSE ps --format '{{.Names}}' postgres 2>/dev/null | head -1 || true)
  if [[ -z "$pg_container" ]]; then
    echo "FAIL: pilot postgres container not running" >&2
    exit 1
  fi
  if [[ "$pg_container" != *pilot* ]]; then
    echo "FAIL: postgres container does not look like pilot: $pg_container" >&2
    exit 1
  fi

  local db
  db=$($ACAR_COMPOSE exec -T postgres psql -U acarindex_pilot -d acarindex_pilot -tAc \
    "SELECT current_database();" | tr -d '[:space:]')
  if [[ "$db" != "acarindex_pilot" ]]; then
    echo "FAIL: expected database acarindex_pilot, got: ${db:-empty}" >&2
    exit 1
  fi
}

acar_beta_trim() { tr -d '\r\n' | xargs; }

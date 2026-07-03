#!/usr/bin/env bash
# Beta pilot — full i18n URL/content/sitemap validation (run on beta server only)
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-pilot-guard.sh
source "$SCRIPT_DIR/lib-pilot-guard.sh"

BASE_LOCAL="${ACAR_BETA_BASE:-http://127.0.0.1:3002}"
# App is on host loopback; ETL container reaches it via host gateway (Linux Docker).
LIVE_FROM_ETL="${ACAR_I18N_LIVE_BASE:-http://host.docker.internal:3002}"
LOG="${ACAR_I18N_VALIDATE_LOG:-/var/log/acarindex-validate-i18n-$(date +%Y%m%d_%H%M%S).json}"
REPORT_TXT="${LOG%.json}.summary.txt"

acar_beta_require_pilot

fail() { echo "FAIL: $1" >&2; exit 1; }

echo "=== I18N VALIDATE $(date -Is) ==="
cd "$ACAR_ROOT"

echo "=== HEALTH ==="
curl -sf "$BASE_LOCAL/api/health" || fail "health check"

echo "=== BUILD ETL (latest validate script) ==="
$ACAR_COMPOSE --profile tools build etl

echo "=== RUN validate-i18n-urls (live base=$LIVE_FROM_ETL) ==="
set +e
$ACAR_COMPOSE --profile tools run --rm \
  --add-host=host.docker.internal:host-gateway \
  -e "I18N_VALIDATE_BASE_URL=$LIVE_FROM_ETL" \
  etl scripts/validate-i18n-urls.ts | tee "$LOG"
EXIT=$?
set -e

if [[ ! -s "$LOG" ]]; then
  fail "empty validate output"
fi

OK=$(grep -o '"ok":[^,]*' "$LOG" | head -1 || true)
{
  echo "timestamp=$(date -Is)"
  echo "log=$LOG"
  echo "exit=$EXIT"
  echo "$OK"
  echo "--- key metrics ---"
  grep -E '"articles_with_computed_en_content"|"articles_eligible_for_en_sitemap"|"has_en_content_flag_drift"|"hreflang_head_sitemap_mismatch"|"empty_en_sitemap_pages"|"invalid_en_redirect_count"|"redirect_loop_count"' "$LOG" | head -20
} | tee "$REPORT_TXT"

if [[ "$EXIT" -ne 0 ]]; then
  echo "FAIL: validate-i18n-urls exit $EXIT — see $LOG" >&2
  exit 1
fi

echo "OK: validate-i18n-beta passed — $LOG"

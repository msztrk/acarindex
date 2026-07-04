#!/usr/bin/env bash
# faz-b-journal-status-audit.sh — grep public journal queries for status='published' filter.
set -Eeuo pipefail

ROOT="${ACAR_ROOT:-/opt/acarindex}"
cd "$ROOT"

echo "=== JOURNAL STATUS AUDIT $(date -Is) ==="

PUBLIC_PATHS=(
  "lib/data/journals.ts"
  "lib/data/catalog.ts"
  "lib/data/search.ts"
  "lib/data/stats.ts"
  "lib/data/platform.ts"
  "lib/i18n/alternate-url.ts"
  "app/api/search-suggest/route.ts"
  "app/sitemap-journals/route.ts"
  "app/sitemap-journals-en/route.ts"
  "proxy.ts"
)

MISSING=0
OK=0

for f in "${PUBLIC_PATHS[@]}"; do
  [[ -f "$f" ]] || continue
  if grep -q "journal\.find" "$f" || grep -q "journal\.count" "$f" || grep -q "journals?" "$f"; then
    if grep -q "status: 'published'" "$f" || grep -q 'status=eq.published' "$f" || grep -q "status='published'" "$f"; then
      echo "OK: $f has published filter"
      OK=$((OK + 1))
    else
      echo "REVIEW: $f uses journal queries — verify filter manually"
      MISSING=$((MISSING + 1))
    fi
  fi
done

echo "=== UNFILTERED CANDIDATES (admin/internal/editor only expected) ==="
rg -n "prisma\.journal\.(findMany|findFirst|findUnique|count)" --glob '*.ts' --glob '*.tsx' \
  lib app components 2>/dev/null | grep -v "status: 'published'" | grep -v "status='published'" | head -40 || true

echo "AUDIT_OK=$OK REVIEW=$MISSING"
echo "ENUM_MIGRATION=not_applied (report only)"

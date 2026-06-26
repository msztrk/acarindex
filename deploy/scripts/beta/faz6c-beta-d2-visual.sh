#!/usr/bin/env bash
set -Eeuo pipefail
SHOT_DIR=/var/log/acarindex-d2-visual-shots
install -d -m 755 "$SHOT_DIR"
docker run --rm \
  -v /opt/acarindex:/app \
  -v "$SHOT_DIR:$SHOT_DIR" \
  -w /app \
  -e BASE_URL=http://127.0.0.1:3002 \
  -e ACAR_D2_SHOTS="$SHOT_DIR" \
  --network host \
  mcr.microsoft.com/playwright:v1.49.1-noble \
  bash -c 'npm install @playwright/test@1.49.1 --no-save 2>/dev/null && npx playwright test --config=playwright.d2-visual.config.ts'
echo "SHOT_DIR=$SHOT_DIR"
ls -la "$SHOT_DIR"
echo "D2_VISUAL_PLAYWRIGHT_OK"

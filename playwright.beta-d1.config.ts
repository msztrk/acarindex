import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests',
  testMatch: 'beta-d1-visual-acceptance.spec.ts',
  timeout: 90000,
  reporter: [['list'], ['json', { outputFile: 'test-results/beta-d1-visual-report.json' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3002',
    screenshot: 'off',
    video: 'off',
  },
})

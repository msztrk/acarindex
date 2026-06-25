import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests',
  testMatch: 'beta-responsive-auth.spec.ts',
  timeout: 60000,
  reporter: [['list'], ['json', { outputFile: 'test-results/beta-responsive-report.json' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3002',
    screenshot: 'off',
    video: 'off',
  },
})

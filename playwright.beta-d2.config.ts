import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests',
  testMatch: 'beta-d2-visual-acceptance.spec.ts',
  timeout: 180000,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000',
    screenshot: 'off',
    video: 'off',
  },
})

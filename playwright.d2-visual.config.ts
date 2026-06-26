import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests',
  testMatch: 'd2-visual-screenshots.spec.ts',
  timeout: 120000,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000',
    screenshot: 'off',
    video: 'off',
  },
})

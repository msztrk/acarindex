import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/external/**',
      'tests/beta-responsive-auth.spec.ts',
      'tests/beta-d1-visual-acceptance.spec.ts',
    ],
    fileParallelism:
      process.env.USER_PANEL_INTEGRATION !== '1' &&
      process.env.AUTH_LIFECYCLE_INTEGRATION !== '1',
    maxWorkers:
      process.env.USER_PANEL_INTEGRATION === '1' ||
      process.env.AUTH_LIFECYCLE_INTEGRATION === '1'
        ? 1
        : undefined,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})

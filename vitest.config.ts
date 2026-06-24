import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    globalSetup: './src/__tests__/helpers/global-setup.ts',
    fileParallelism: false,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    env: {
      DATABASE_URL: 'file:./test.db',
    },
  },
})

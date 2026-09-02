import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // etapa5-e2e hace fetch contra un servidor real (localhost:3000):
    // es un smoke de integración, no un unit test. Se corre aparte.
    // Los *.integration.test.ts requieren DB y se corren con vitest.integration.config.ts.
    exclude: [
      'node_modules',
      '.next',
      'e2e/**',
      'src/__tests__/etapa5-e2e.test.ts',
      'src/**/*.integration.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/server/services/**'],
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})

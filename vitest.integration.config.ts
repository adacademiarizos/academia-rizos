import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Configuración separada para tests de INTEGRACIÓN (DB real `elizabeth_test`).
// Se ejecutan en serie (una sola fork) porque comparten la base de datos y la
// resetean entre tests. Requiere `.env.test` (ver scripts/setup-test-db.mjs).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    setupFiles: ['src/test/setup-integration.ts'],
    // Serial: todos los archivos comparten la DB de test y la resetean entre tests.
    fileParallelism: false,
    pool: 'forks',
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})

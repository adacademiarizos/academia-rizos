/**
 * Setup de la base de datos de TEST (aislada de la de desarrollo).
 * - Crea la DB `elizabeth_test` en el mismo PostgreSQL local.
 * - Genera `.env.test` apuntando a ella (claves externas como dummies).
 * No toca la DB de desarrollo ni sus datos.
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const envText = readFileSync('.env', 'utf8')
const m = envText.match(/^DATABASE_URL=["']?([^"'\n\r]+)/m)
if (!m) {
  console.error('No se encontró DATABASE_URL en .env')
  process.exit(1)
}
const dbUrl = m[1]
const TEST_DB = 'elizabeth_test'
const testUrl = new URL(dbUrl)
testUrl.pathname = '/' + TEST_DB

// 1) Crear la DB de test (conectando a la DB de desarrollo existente)
const admin = new PrismaClient({ datasourceUrl: dbUrl })
try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${TEST_DB}"`)
  console.log('✅ Base de datos de test creada:', TEST_DB)
} catch (e) {
  if (/already exists/i.test(e.message)) {
    console.log('ℹ️  La base de datos de test ya existía:', TEST_DB)
  } else {
    console.error('❌ Error creando la DB de test:', e.message)
    process.exit(1)
  }
} finally {
  await admin.$disconnect()
}

// 2) Generar .env.test (sin sobreescribir si ya existe)
if (!existsSync('.env.test')) {
  const content = [
    '# Generado por scripts/setup-test-db.mjs — DB aislada para integración',
    `DATABASE_URL="${testUrl.toString()}"`,
    'NEXT_PUBLIC_APP_URL=http://localhost:3000',
    'NEXTAUTH_URL=http://localhost:3000',
    'NEXTAUTH_SECRET=test-secret-not-real',
    'GOOGLE_CLIENT_ID=test-client-id',
    'GOOGLE_CLIENT_SECRET=test-client-secret',
    'STRIPE_SECRET_KEY=sk_test_dummy',
    'STRIPE_WEBHOOK_SECRET=whsec_dummy',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_dummy',
    'EMAIL_FROM=test@example.com',
    '',
  ].join('\n')
  writeFileSync('.env.test', content)
  console.log('✅ .env.test creado')
} else {
  console.log('ℹ️  .env.test ya existe, no se modifica')
}
console.log('   DB de test:', testUrl.hostname + testUrl.pathname)

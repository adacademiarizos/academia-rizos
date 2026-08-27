import dotenv from 'dotenv'
import { resolve } from 'node:path'

// Cargar el entorno de test ANTES de que se importen módulos que leen process.env
// (p. ej. @/lib/db crea el PrismaClient con DATABASE_URL al importarse).
dotenv.config({ path: resolve(process.cwd(), '.env.test'), override: true })

// 🔒 GUARD DE SEGURIDAD: nunca ejecutar tests de integración contra una DB que no
// sea explícitamente de test. Si la carga de .env.test falló o la URL apunta a la
// base de datos de desarrollo/producción, abortamos para no truncar datos reales.
const url = process.env.DATABASE_URL ?? ''
if (!/_test(\b|\?|$)/.test(url)) {
  throw new Error(
    `[setup-integration] DATABASE_URL no apunta a una base *_test (got: ${url.replace(/:[^:@/]+@/, ':***@')}). ` +
      'Abortando para proteger datos reales. Ejecuta `npm run test:db:setup` primero.'
  )
}

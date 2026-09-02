/**
 * Matriz de autorización (red de seguridad estática)
 *
 * El proyecto NO tiene un `middleware.ts` central: cada `route.ts` debe verificar
 * permisos por su cuenta. Este test recorre los 125 endpoints y falla si alguno
 * no referencia un guard de auth conocido NI está declarado como público.
 *
 * Objetivo: que añadir una ruta nueva sin protección (o sin clasificarla como
 * pública de forma explícita) rompa el build, evitando fugas por olvido.
 *
 * Nota: es análisis estático a nivel de archivo. Reconoce los wrappers de auth
 * (incluido `withAnalyticsAuth`, que envuelve a `checkAdminAuth`). No sustituye a
 * los tests de integración por rol (fase 2 del plan), pero atrapa el olvido total.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const API_DIR = join(process.cwd(), 'src', 'app', 'api')

/** Tokens que, presentes en un route.ts, indican que verifica identidad/permiso. */
const AUTH_GUARDS = [
  'checkAdminAuth',
  'checkStaffAuth',
  'withAnalyticsAuth',
  'getServerSession',
  'verifyStripeWebhook', // valida la firma del webhook (no hay sesión de usuario)
  'getAdminUser', // guard de admin del módulo de academia
  'requireAdminForScope', // guards por scope de learning-api
  'requireStaffForScope',
  'requireStudentForScope',
  'authorizeCourseAccess', // prefijo de authorizeCourseAccessByCourseId/ModuleId/StyleId
  'isAuthorized', // rutas de cron: validan el bearer CRON_SECRET
]

/**
 * Endpoints públicos por diseño (no requieren guard de sesión).
 * Cualquier ruta nueva que no esté aquí Y no tenga guard hará fallar el test:
 * eso es intencional — obliga a clasificarla conscientemente.
 */
const PUBLIC_ALLOWLIST = new Set<string>([
  'auth/[...nextauth]', // handler de NextAuth
  'auth/register', // alta de cuenta
  'availability', // disponibilidad para el wizard de reserva
  'availability/days',
  'bookings/draft', // reserva como invitado
  'courses', // catálogo
  'courses/[courseId]',
  'faq',
  'likes/count', // contador público
  'pay/[id]/checkout', // checkout de link de pago (cliente sin login)
  'schedule', // horarios de atención públicos
  'services', // catálogo de servicios
  'services/[serviceId]/staff',
  'stripe/checkout', // crea sesión de pago (flujo de invitado)
  'testimonials',
  'analytics/pageview', // tracking anónimo desde el cliente
  'users/[userId]/activity', // perfil público
  'users/[userId]/profile',
  'auth/forgot-password', // flujo de recuperación: sin sesión por definición
  'auth/reset-password', // canjea un token de un solo uso, sin sesión
  'student/modules/[moduleId]/styles', // stub de compatibilidad: devuelve lista vacía
])

function findRouteFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...findRouteFiles(full))
    else if (entry.name === 'route.ts' || entry.name === 'route.tsx') out.push(full)
  }
  return out
}

/** "src/app/api/courses/[courseId]/route.ts" -> "courses/[courseId]" */
function toEndpoint(file: string): string {
  const rel = relative(API_DIR, file).split(sep).slice(0, -1).join('/')
  return rel
}

const routeFiles = findRouteFiles(API_DIR)

describe('Matriz de autorización de endpoints API', () => {
  it('encuentra el árbol de rutas', () => {
    expect(routeFiles.length).toBeGreaterThan(100)
  })

  it('toda ruta protegida referencia un guard de auth (o está en la allowlist pública)', () => {
    const unprotected: string[] = []

    for (const file of routeFiles) {
      const endpoint = toEndpoint(file)
      if (PUBLIC_ALLOWLIST.has(endpoint)) continue

      const content = readFileSync(file, 'utf8')
      const hasGuard = AUTH_GUARDS.some((g) => content.includes(g))
      if (!hasGuard) unprotected.push(endpoint)
    }

    expect(
      unprotected,
      `Rutas sin guard de auth y no declaradas públicas:\n  - ${unprotected.join(
        '\n  - '
      )}\nProtégelas (checkAdminAuth/checkStaffAuth/getServerSession) o añádelas a PUBLIC_ALLOWLIST si son públicas a propósito.`
    ).toEqual([])
  })

  it('la allowlist pública no contiene rutas inexistentes (evita allowlist obsoleta)', () => {
    const existing = new Set(routeFiles.map(toEndpoint))
    const stale = [...PUBLIC_ALLOWLIST].filter((e) => !existing.has(e))

    expect(
      stale,
      `Entradas en PUBLIC_ALLOWLIST que ya no existen como ruta: ${stale.join(', ')}`
    ).toEqual([])
  })
})

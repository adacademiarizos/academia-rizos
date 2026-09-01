import { db } from '@/lib/db'

export { db }

/**
 * Vacía todas las tablas de la DB de test (respeta FKs con CASCADE).
 * Llamar en beforeEach para aislar cada test.
 */
export async function resetDb() {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `
  if (rows.length === 0) return
  const list = rows.map((r) => `"${r.tablename}"`).join(', ')
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
}

/** Crea un usuario con rol (ADMIN | STAFF | STUDENT). */
export async function createUser(overrides: Partial<{
  email: string
  name: string
  role: 'ADMIN' | 'STAFF' | 'STUDENT'
}> = {}) {
  const rnd = Math.random().toString(36).slice(2, 8)
  return db.user.create({
    data: {
      email: overrides.email ?? `user-${rnd}@test.local`,
      name: overrides.name ?? `User ${rnd}`,
      role: overrides.role ?? 'STUDENT',
    },
  })
}

/** Crea un servicio + un staff con precio configurado, listo para reservar. */
export async function createBookableService(opts: {
  billingRule?: 'FULL' | 'DEPOSIT' | 'AUTHORIZE'
  durationMin?: number
  priceCents?: number
  isActive?: boolean
} = {}) {
  const staff = await createUser({ role: 'STAFF' })
  const service = await db.service.create({
    data: {
      name: `Servicio ${Math.random().toString(36).slice(2, 6)}`,
      durationMin: opts.durationMin ?? 60,
      billingRule: opts.billingRule ?? 'FULL',
      isActive: opts.isActive ?? true,
      depositPct: opts.billingRule === 'DEPOSIT' ? 30 : null,
    },
  })
  await db.serviceStaffPrice.create({
    data: {
      serviceId: service.id,
      staffId: staff.id,
      priceCents: opts.priceCents ?? 5000,
      currency: 'EUR',
    },
  })
  return { service, staff }
}

/** Configura el horario de apertura para un día de la semana (0=domingo..6=sábado). */
export async function setBusinessHours(dayOfWeek: number, openTime = '09:00', closeTime = '18:00', isOpen = true) {
  return db.businessHours.upsert({
    where: { dayOfWeek },
    create: { dayOfWeek, openTime, closeTime, isOpen },
    update: { openTime, closeTime, isOpen },
  })
}

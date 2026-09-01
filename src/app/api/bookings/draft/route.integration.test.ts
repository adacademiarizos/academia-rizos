/**
 * Integración — POST /api/bookings/draft
 * Reglas de negocio de la creación de citas, contra la DB de test.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'

// Evitar envíos de email reales (el flujo AUTHORIZE notifica por correo).
vi.mock('@/lib/mail', () => ({
  sendAppointmentNotificationEmail: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from './route'
import { db, resetDb, createUser, createBookableService } from '@/test/db-helper'

function post(body: unknown) {
  return POST(
    new Request('http://localhost:3000/api/bookings/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

const futureIso = (daysAhead = 7, hour = 10) => {
  const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

const customer = { name: 'Ana Cliente', email: 'ana@test.local', phone: '600000000' }

describe('POST /api/bookings/draft (integración)', () => {
  beforeEach(async () => {
    await resetDb()
  })
  afterAll(async () => {
    await db.$disconnect()
  })

  it('devuelve 400 si faltan campos obligatorios', async () => {
    const res = await post({ serviceId: '', staffId: '', startAt: '', customer: {} })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('BAD_REQUEST')
  })

  it('devuelve 404 si el servicio no existe o está inactivo', async () => {
    const { service, staff } = await createBookableService({ isActive: false })
    const res = await post({ serviceId: service.id, staffId: staff.id, startAt: futureIso(), customer })
    expect(res.status).toBe(404)
  })

  it('devuelve 400 NO_PRICE si no hay precio configurado para staff/servicio', async () => {
    const staff = await createUser({ role: 'STAFF' })
    const service = await db.service.create({
      data: { name: 'Sin precio', durationMin: 60, billingRule: 'FULL', isActive: true },
    })
    const res = await post({ serviceId: service.id, staffId: staff.id, startAt: futureIso(), customer })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('NO_PRICE')
  })

  it('devuelve 400 BAD_DATE con una fecha inválida', async () => {
    const { service, staff } = await createBookableService()
    const res = await post({ serviceId: service.id, staffId: staff.id, startAt: 'no-es-fecha', customer })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('BAD_DATE')
  })

  it('crea una cita PENDING y calcula endAt = startAt + duración', async () => {
    const { service, staff } = await createBookableService({ durationMin: 90, billingRule: 'FULL', priceCents: 8000 })
    const startAt = futureIso(7, 10)
    const res = await post({ serviceId: service.id, staffId: staff.id, startAt, customer })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.billingRule).toBe('FULL')
    expect(json.data.priceCents).toBe(8000)

    const appt = await db.appointment.findUnique({ where: { id: json.data.appointmentId } })
    expect(appt?.status).toBe('PENDING')
    expect(appt!.endAt.getTime() - appt!.startAt.getTime()).toBe(90 * 60 * 1000)
  })

  it('vincula customerId si el email ya tiene cuenta registrada', async () => {
    const existing = await createUser({ email: 'ana@test.local', role: 'STUDENT' })
    const { service, staff } = await createBookableService()
    const res = await post({ serviceId: service.id, staffId: staff.id, startAt: futureIso(), customer })
    const json = await res.json()
    const appt = await db.appointment.findUnique({ where: { id: json.data.appointmentId } })
    expect(appt?.customerId).toBe(existing.id)
  })

  it('rechaza una reserva en un horario EXACTO ya ocupado (409 TAKEN)', async () => {
    const { service, staff } = await createBookableService({ durationMin: 60 })
    const startAt = futureIso(7, 10)
    const first = await post({ serviceId: service.id, staffId: staff.id, startAt, customer })
    expect(first.status).toBe(200)

    const second = await post({ serviceId: service.id, staffId: staff.id, startAt, customer })
    expect(second.status).toBe(409)
    expect((await second.json()).error.code).toBe('TAKEN')
  })

  it('LIMITACIÓN CONOCIDA (§8 #3): NO detecta solapamiento parcial — hoy acepta la cita solapada', async () => {
    const { service, staff } = await createBookableService({ durationMin: 60 })
    // Cita existente 10:00–11:00
    await post({ serviceId: service.id, staffId: staff.id, startAt: futureIso(7, 10), customer })

    // Nueva cita a las 10:30 → solapa, pero startAt distinto.
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    d.setHours(10, 30, 0, 0)
    const overlapping = await post({ serviceId: service.id, staffId: staff.id, startAt: d.toISOString(), customer })

    // Comportamiento ACTUAL (incorrecto): la crea porque solo compara startAt exacto.
    // Cuando se corrija el bug (chequeo de solapamiento + constraint), cambiar a 409.
    expect(overlapping.status).toBe(200)
    const count = await db.appointment.count({ where: { staffId: staff.id } })
    expect(count).toBe(2) // ← deberían ser 1 cita válida; documenta el bug
  })

  it('AUTHORIZE: crea cita PENDING y notifica a los admins', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    const { service, staff } = await createBookableService({ billingRule: 'AUTHORIZE' })
    const res = await post({ serviceId: service.id, staffId: staff.id, startAt: futureIso(), customer })
    expect(res.status).toBe(200)
    expect((await res.json()).data.billingRule).toBe('AUTHORIZE')

    const adminNotifs = await db.notification.count({
      where: { userId: admin.id, type: 'APPOINTMENT' },
    })
    expect(adminNotifs).toBeGreaterThanOrEqual(1)
  })
})

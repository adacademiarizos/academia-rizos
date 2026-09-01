/**
 * Integración — GET /api/availability
 * Ejercita el handler real contra la DB de test (elizabeth_test).
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { GET } from './route'
import { db, resetDb, createBookableService, setBusinessHours } from '@/test/db-helper'

function get(url: string) {
  return GET(new Request(`http://localhost:3000${url}`))
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Una fecha a +N días, con su día de la semana y string YYYY-MM-DD (en hora local). */
function futureDate(daysAhead: number) {
  const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { date: d, dow: d.getDay(), dateStr }
}

describe('GET /api/availability (integración)', () => {
  beforeEach(async () => {
    await resetDb()
  })

  afterAll(async () => {
    await db.$disconnect()
  })

  it('devuelve 400 si faltan serviceId/staffId', async () => {
    const res = await get('/api/availability')
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('MISSING_PARAMS')
  })

  it('devuelve 404 si el servicio está inactivo', async () => {
    const { service, staff } = await createBookableService({ isActive: false })
    const res = await get(`/api/availability?serviceId=${service.id}&staffId=${staff.id}`)
    expect(res.status).toBe(404)
  })

  it('genera slots en un día abierto', async () => {
    const { service, staff } = await createBookableService({ durationMin: 60 })
    const { dow, dateStr } = futureDate(7)
    await setBusinessHours(dow, '09:00', '18:00', true)

    const res = await get(`/api/availability?serviceId=${service.id}&staffId=${staff.id}&date=${dateStr}`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    // 09:00..17:00 con bloques de 60min → 9 inicios posibles
    expect(json.data.slots.length).toBe(9)
    expect(json.data.slots.every((s: string) => s.startsWith(dateStr))).toBe(true)
  })

  it('no genera slots en un día cerrado (isOpen=false)', async () => {
    const { service, staff } = await createBookableService()
    const { dow, dateStr } = futureDate(7)
    await setBusinessHours(dow, '09:00', '18:00', false)

    const json = await (await get(`/api/availability?serviceId=${service.id}&staffId=${staff.id}&date=${dateStr}`)).json()
    expect(json.ok).toBe(true)
    expect(json.data.slots).toEqual([])
  })

  it('no genera slots en un día marcado como off-day', async () => {
    const { service, staff } = await createBookableService()
    const { date, dow, dateStr } = futureDate(7)
    await setBusinessHours(dow, '09:00', '18:00', true)
    await db.businessOffDay.create({
      data: { date: new Date(date.getFullYear(), date.getMonth(), date.getDate()) },
    })

    const json = await (await get(`/api/availability?serviceId=${service.id}&staffId=${staff.id}&date=${dateStr}`)).json()
    expect(json.data.slots).toEqual([])
  })

  it('excluye un slot ya ocupado por una cita PENDING', async () => {
    const { service, staff } = await createBookableService({ durationMin: 60 })
    const { date, dow, dateStr } = futureDate(7)
    await setBusinessHours(dow, '09:00', '18:00', true)

    // Ocupar el slot de las 10:00 (hora local)
    const occupied = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0, 0, 0)
    await db.appointment.create({
      data: {
        serviceId: service.id,
        staffId: staff.id,
        startAt: occupied,
        endAt: new Date(occupied.getTime() + 60 * 60 * 1000),
        status: 'PENDING',
        customerName: 'Ocupa',
        customerEmail: 'ocupa@test.local',
      },
    })

    const json = await (await get(`/api/availability?serviceId=${service.id}&staffId=${staff.id}&date=${dateStr}`)).json()
    const slots: string[] = json.data.slots
    expect(slots).not.toContain(`${dateStr}T10:00:00`)
    // El resto de slots siguen disponibles (9 - 1 = 8)
    expect(slots.length).toBe(8)
  })
})

import { describe, it, expect } from 'vitest'
import { formatBusinessHoursLines } from '@/lib/business-hours'

const open = (dayOfWeek: number, openTime: string, closeTime: string) => ({
  dayOfWeek,
  isOpen: true,
  openTime,
  closeTime,
})

const closed = (dayOfWeek: number) => ({
  dayOfWeek,
  isOpen: false,
  openTime: '00:00',
  closeTime: '00:00',
})

describe('formatBusinessHoursLines', () => {
  it('collapses a regular week into three readable lines', () => {
    const rows = [
      closed(0),
      open(1, '10:00', '20:00'),
      open(2, '10:00', '20:00'),
      open(3, '10:00', '20:00'),
      open(4, '10:00', '20:00'),
      open(5, '10:00', '20:00'),
      open(6, '10:00', '15:00'),
    ]

    expect(formatBusinessHoursLines(rows)).toEqual([
      'Lunes - Viernes: 10:00 - 20:00',
      'Sábado: 10:00 - 15:00',
      'Domingo: cerrado',
    ])
  })

  it('starts the week on Monday and ends it on Sunday', () => {
    const rows = [closed(0), open(1, '09:00', '18:00')]

    expect(formatBusinessHoursLines(rows)).toEqual([
      'Lunes: 09:00 - 18:00',
      'Domingo: cerrado',
    ])
  })

  it('returns nothing when no hours have been configured', () => {
    expect(formatBusinessHoursLines([])).toEqual([])
  })
})

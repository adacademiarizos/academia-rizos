import { describe, it, expect } from 'vitest'
import { addStripeFees } from '@/lib/fees'

describe('addStripeFees', () => {
  it('aplica porcentaje + fijo sobre el importe base', () => {
    // 100.00 € con 2.5% + 0.25 € fijo → 0.25 % = 2.50, fijo 0.25 → 102.75 €
    const r = addStripeFees({ baseCents: 10000, feePercent: 2.5, feeFixedCents: 25 })
    expect(r.totalCents).toBe(10275)
    expect(r.feeCents).toBe(275)
  })

  it('sobre importe 0 solo cobra el fijo', () => {
    const r = addStripeFees({ baseCents: 0, feePercent: 2.5, feeFixedCents: 25 })
    expect(r.totalCents).toBe(25)
    expect(r.feeCents).toBe(25)
  })

  it('sin comisión (0% y 0 fijo) el total es el base', () => {
    const r = addStripeFees({ baseCents: 5000, feePercent: 0, feeFixedCents: 0 })
    expect(r.totalCents).toBe(5000)
    expect(r.feeCents).toBe(0)
  })

  it('redondea a céntimos enteros (sin fracciones)', () => {
    // 9.99 € * 2.5% = 0.24975 € → total = round(999 + 24.975 + 25) = 1049
    const r = addStripeFees({ baseCents: 999, feePercent: 2.5, feeFixedCents: 25 })
    expect(Number.isInteger(r.totalCents)).toBe(true)
    expect(r.totalCents).toBe(1049)
    expect(r.feeCents).toBe(50)
  })

  it('mantiene la coherencia feeCents = totalCents - baseCents', () => {
    const base = 73321
    const r = addStripeFees({ baseCents: base, feePercent: 1.4, feeFixedCents: 30 })
    expect(r.feeCents).toBe(r.totalCents - base)
  })
})

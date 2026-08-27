import { describe, it, expect } from 'vitest'
import { formatPriceCents, formatPriceRange } from '@/lib/price-utils'

describe('formatPriceCents', () => {
  it('formatea céntimos a euros con 2 decimales', () => {
    expect(formatPriceCents(10000)).toBe('100.00 EUR')
  })

  it('respeta la moneda indicada', () => {
    expect(formatPriceCents(10000, 'USD')).toBe('100.00 USD')
  })

  it('formatea 0 correctamente', () => {
    expect(formatPriceCents(0)).toBe('0.00 EUR')
  })

  it('formatea importes no redondos', () => {
    expect(formatPriceCents(999)).toBe('9.99 EUR')
  })
})

describe('formatPriceRange', () => {
  it('devuelve "Consultar" cuando no hay ningún precio', () => {
    expect(formatPriceRange(null, null)).toBe('Consultar')
  })

  it('colapsa a un único precio cuando min === max', () => {
    expect(formatPriceRange(10000, 10000)).toBe('100.00 EUR')
  })

  it('muestra rango sin decimales cuando min y max difieren', () => {
    expect(formatPriceRange(10000, 20000)).toBe('100 - 200 EUR')
  })

  it('usa el único precio disponible cuando falta uno de los extremos', () => {
    expect(formatPriceRange(10000, null)).toBe('100.00 EUR')
    expect(formatPriceRange(null, 20000)).toBe('200.00 EUR')
  })
})

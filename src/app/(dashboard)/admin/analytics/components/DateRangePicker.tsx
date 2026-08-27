'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'Este mes', days: -1 },
  { label: 'Mes pasado', days: -2 },
  { label: 'Todo', days: 365 },
]

function formatDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function getPresetRange(preset: (typeof PRESETS)[number], to: string) {
  if (preset.days === -1) {
    const [year, month] = to.split('-').map(Number)
    return {
      from: `${year}-${String(month).padStart(2, '0')}-01`,
      to,
    }
  }
  if (preset.days === -2) {
    const [year, month] = to.split('-').map(Number)
    const firstThisMonth = new Date(Date.UTC(year, month - 1, 1))
    const lastLastMonth = new Date(firstThisMonth)
    lastLastMonth.setUTCDate(0)
    return {
      from: `${lastLastMonth.getUTCFullYear()}-${String(lastLastMonth.getUTCMonth() + 1).padStart(2, '0')}-01`,
      to: lastLastMonth.toISOString().slice(0, 10),
    }
  }
  return {
    from: shiftDateKey(to, -(preset.days - 1)),
    to,
  }
}

export function useDateRange() {
  const searchParams = useSearchParams()
  const [defaultRange] = useState(() => {
    const to = formatDate(new Date())
    return { from: shiftDateKey(to, -29), to }
  })

  const from = searchParams.get('from') || defaultRange.from
  const to = searchParams.get('to') || defaultRange.to
  return { from, to, isReady: true }
}

export function DateRangePicker() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { from: currentFrom, to: currentTo } = useDateRange()

  function setRange(from: string, to: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('from', from)
    params.set('to', to)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => {
        const range = getPresetRange(preset, currentTo)
        const active = currentFrom === range.from && currentTo === range.to
        return (
          <button
            key={preset.label}
            onClick={() => setRange(range.from, range.to)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              active
                ? 'bg-ap-copper text-white'
                : 'bg-white/5 text-white/50 hover:text-white/80 hover:bg-white/10'
            }`}
          >
            {preset.label}
          </button>
        )
      })}
      <div className="flex items-center gap-2 ml-2">
        <input
          type="date"
          value={currentFrom}
          max={currentTo}
          onChange={(e) => setRange(e.target.value, currentTo)}
          className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/70 [color-scheme:dark]"
        />
        <span className="text-white/30 text-xs">—</span>
        <input
          type="date"
          value={currentTo}
          min={currentFrom}
          onChange={(e) => setRange(currentFrom, e.target.value)}
          className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/70 [color-scheme:dark]"
        />
      </div>
    </div>
  )
}

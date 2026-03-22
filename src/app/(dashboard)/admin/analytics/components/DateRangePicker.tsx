'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'Este mes', days: -1 },
  { label: 'Mes pasado', days: -2 },
  { label: 'Todo', days: 365 },
]

function formatDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function getPresetRange(preset: (typeof PRESETS)[number]) {
  const now = new Date()
  if (preset.days === -1) {
    // This month
    return {
      from: formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: formatDate(now),
    }
  }
  if (preset.days === -2) {
    // Last month
    const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    return {
      from: formatDate(firstLastMonth),
      to: formatDate(lastLastMonth),
    }
  }
  return {
    from: formatDate(new Date(Date.now() - preset.days * 24 * 60 * 60 * 1000)),
    to: formatDate(now),
  }
}

export function useDateRange() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  const to = searchParams.get('to') || formatDate(new Date())
  return { from, to }
}

export function DateRangePicker() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentFrom = searchParams.get('from') || ''
  const currentTo = searchParams.get('to') || ''

  function setRange(from: string, to: string) {
    const params = new URLSearchParams()
    params.set('from', from)
    params.set('to', to)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => {
        const range = getPresetRange(preset)
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
          value={currentFrom || formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))}
          onChange={(e) => setRange(e.target.value, currentTo || formatDate(new Date()))}
          className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/70 [color-scheme:dark]"
        />
        <span className="text-white/30 text-xs">—</span>
        <input
          type="date"
          value={currentTo || formatDate(new Date())}
          onChange={(e) => setRange(currentFrom || formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), e.target.value)}
          className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/70 [color-scheme:dark]"
        />
      </div>
    </div>
  )
}

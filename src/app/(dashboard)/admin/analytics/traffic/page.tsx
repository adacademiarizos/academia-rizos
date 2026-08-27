'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { TrafficChart } from '../components/TrafficChart'
import { DataTable } from '../components/DataTable'

export default function TrafficPage() {
  const searchParams = useSearchParams()
  const [defaultRange] = useState(() => ({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  }))
  const from = searchParams.get('from') || defaultRange.from
  const to = searchParams.get('to') || defaultRange.to

  const [traffic, setTraffic] = useState<any[]>([])
  const [pages, setPages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const qs = `from=${from}&to=${to}`
    Promise.all([
      fetch(`/api/admin/analytics/traffic?${qs}`).then((r) => r.json()),
      fetch(`/api/admin/analytics/pages?${qs}`).then((r) => r.json()),
    ])
      .then(([tr, pg]) => {
        setTraffic(tr.data || [])
        setPages(pg.data || [])
      })
      .finally(() => setLoading(false))
  }, [from, to])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 h-80 animate-pulse" />
        <div className="rounded-2xl border border-white/10 bg-white/5 h-60 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <TrafficChart data={traffic} />

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">
          Páginas más visitadas
        </h3>
        <DataTable
          columns={[
            { key: 'path', label: 'Página' },
            { key: 'views', label: 'Visitas', align: 'right', render: (r: any) => r.views.toLocaleString('es-ES') },
            { key: 'sessions', label: 'Sesiones', align: 'right', render: (r: any) => r.sessions.toLocaleString('es-ES') },
          ]}
          data={pages}
          emptyMessage="Sin datos de páginas para este periodo"
        />
      </div>
    </div>
  )
}

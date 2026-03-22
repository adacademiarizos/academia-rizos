'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { StatCard } from './components/StatCard'
import { TrafficChart } from './components/TrafficChart'
import { SourcesChart } from './components/SourcesChart'

function formatMoney(cents: number) {
  return `€${(cents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`
}

export default function AnalyticsOverviewPage() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const to = searchParams.get('to') || new Date().toISOString().split('T')[0]

  const [overview, setOverview] = useState<any>(null)
  const [traffic, setTraffic] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const qs = `from=${from}&to=${to}`
    Promise.all([
      fetch(`/api/admin/analytics/overview?${qs}`).then((r) => r.json()),
      fetch(`/api/admin/analytics/traffic?${qs}`).then((r) => r.json()),
      fetch(`/api/admin/analytics/sources?${qs}`).then((r) => r.json()),
    ])
      .then(([ov, tr, src]) => {
        setOverview(ov.data)
        setTraffic(tr.data || [])
        setSources(src.data?.sources || [])
      })
      .finally(() => setLoading(false))
  }, [from, to])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-5 h-24 animate-pulse" />
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 h-80 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Visitas" value={overview?.totalViews?.toLocaleString('es-ES') ?? '0'} />
        <StatCard label="Sesiones Únicas" value={overview?.uniqueSessions?.toLocaleString('es-ES') ?? '0'} />
        <StatCard label="Conversiones" value={overview?.totalConversions?.toLocaleString('es-ES') ?? '0'} accent />
        <StatCard label="Tasa Conversión" value={`${overview?.conversionRate ?? 0}%`} />
        <StatCard label="Ingresos" value={formatMoney(overview?.totalRevenueCents ?? 0)} accent />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TrafficChart data={traffic} />
        <SourcesChart data={sources} />
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FunnelChart } from '../components/FunnelChart'
import { StatCard } from '../components/StatCard'

function formatMoney(cents: number) {
  return `€${(cents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`
}

export default function ConversionsPage() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const to = searchParams.get('to') || new Date().toISOString().split('T')[0]

  const [funnel, setFunnel] = useState<any>(null)
  const [overview, setOverview] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const qs = `from=${from}&to=${to}`
    Promise.all([
      fetch(`/api/admin/analytics/funnel?${qs}`).then((r) => r.json()),
      fetch(`/api/admin/analytics/overview?${qs}`).then((r) => r.json()),
    ])
      .then(([fn, ov]) => {
        setFunnel(fn.data)
        setOverview(ov.data)
      })
      .finally(() => setLoading(false))
  }, [from, to])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-5 h-24 animate-pulse" />
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 h-60 animate-pulse" />
      </div>
    )
  }

  const funnelSteps = funnel
    ? [
        { label: 'Visitantes totales', value: funnel.totalVisitors },
        { label: 'Vieron un curso', value: funnel.coursePageVisitors },
        { label: 'Compraron curso', value: funnel.purchases },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* Conversion summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Compras de cursos"
          value={funnel?.purchases ?? 0}
          accent
        />
        <StatCard
          label="Reservas de citas"
          value={funnel?.bookings ?? 0}
        />
        <StatCard
          label="Registros"
          value={funnel?.registrations ?? 0}
        />
        <StatCard
          label="Ingresos totales"
          value={formatMoney(overview?.totalRevenueCents ?? 0)}
          accent
        />
      </div>

      {/* Funnel visualization */}
      <FunnelChart steps={funnelSteps} />
    </div>
  )
}

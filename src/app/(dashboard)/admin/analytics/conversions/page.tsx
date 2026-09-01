"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FunnelChart } from '../components/FunnelChart'
import { StatCard } from '../components/StatCard'
import { useDateRange } from '../components/DateRangePicker'

type Funnel = {
  totalVisitors: number
  coursePageVisitors: number
  purchases: number
  bookings: number
  registrations: number
}

type Overview = {
  totalRevenueCents: number
}

function formatMoney(cents: number) {
  return `€${(cents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`
}

export default function ConversionsPage() {
  const searchParams = useSearchParams()
  const { from, to, isReady } = useDateRange()
  const academyScope = searchParams.get('scope') === 'academy'

  const [funnel, setFunnel] = useState<Funnel | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isReady) return

    const controller = new AbortController()
    let isCurrent = true
    const params = new URLSearchParams({ from, to })
    if (academyScope) params.set('scope', 'academy')

    Promise.all([
      fetch(`/api/admin/analytics/funnel?${params.toString()}`, { signal: controller.signal }),
      fetch(`/api/admin/analytics/overview?${params.toString()}`, { signal: controller.signal }),
    ])
      .then(async ([funnelResponse, overviewResponse]) => {
        if (!funnelResponse.ok || !overviewResponse.ok) {
          throw new Error('No fue posible cargar las conversiones.')
        }
        const [funnelPayload, overviewPayload] = await Promise.all([funnelResponse.json(), overviewResponse.json()])
        if (!isCurrent) return
        setFunnel(funnelPayload.data ?? null)
        setOverview(overviewPayload.data ?? null)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        if (!isCurrent) return
        setError('No fue posible cargar las conversiones. Inténtalo de nuevo en unos minutos.')
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => {
      isCurrent = false
      controller.abort()
    }
  }, [academyScope, from, isReady, to])

  if (!isReady || loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5 p-5" />
          ))}
        </div>
        <div className="h-60 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
      </div>
    )
  }

  if (error) {
    return <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-5 text-sm text-amber-100">{error}</div>
  }

  const funnelSteps = funnel
    ? [
        { label: 'Visitantes totales', value: funnel.totalVisitors },
        { label: 'Vieron un curso', value: funnel.coursePageVisitors },
        { label: 'Compraron curso', value: funnel.purchases },
      ]
    : []
  const courseConversion = funnel?.totalVisitors
    ? `${((funnel.purchases / funnel.totalVisitors) * 100).toFixed(2)}%`
    : '0.00%'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">{academyScope ? 'Conversiones de la academia' : 'Conversiones del website'}</h2>
        <p className="mt-1 text-sm text-white/50">
          {academyScope ? 'Solo compras de cursos confirmadas; se excluyen reservas y links de pago.' : 'Embudo general de adquisición y conversión.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Compras de cursos" value={funnel?.purchases ?? 0} accent />
        {academyScope ? (
          <>
            <StatCard label="Vieron un curso" value={funnel?.coursePageVisitors ?? 0} />
            <StatCard label="Conversión a compra" value={courseConversion} />
            <StatCard label="Facturación de academia" value={formatMoney(overview?.totalRevenueCents ?? 0)} accent />
          </>
        ) : (
          <>
            <StatCard label="Reservas de citas" value={funnel?.bookings ?? 0} />
            <StatCard label="Registros" value={funnel?.registrations ?? 0} />
            <StatCard label="Ingresos totales" value={formatMoney(overview?.totalRevenueCents ?? 0)} accent />
          </>
        )}
      </div>

      <FunnelChart steps={funnelSteps} />
    </div>
  )
}

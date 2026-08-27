'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { DataTable } from '../components/DataTable'

function formatMoney(cents: number) {
  return `€${(cents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`
}

export default function CampaignsPage() {
  const searchParams = useSearchParams()
  const [defaultRange] = useState(() => ({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  }))
  const from = searchParams.get('from') || defaultRange.from
  const to = searchParams.get('to') || defaultRange.to

  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/analytics/campaigns?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((res) => setCampaigns(res.data || []))
      .finally(() => setLoading(false))
  }, [from, to])

  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-white/5 h-60 animate-pulse" />
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">
        Rendimiento de campañas UTM
      </h3>
      <DataTable
        columns={[
          { key: 'campaign', label: 'Campaña' },
          { key: 'source', label: 'Fuente' },
          { key: 'medium', label: 'Medio' },
          { key: 'views', label: 'Visitas', align: 'right', render: (r: any) => r.views.toLocaleString('es-ES') },
          { key: 'sessions', label: 'Sesiones', align: 'right', render: (r: any) => r.sessions.toLocaleString('es-ES') },
          { key: 'conversions', label: 'Conversiones', align: 'right', render: (r: any) => (
            <span className={r.conversions > 0 ? 'text-ap-copper font-semibold' : ''}>
              {r.conversions}
            </span>
          )},
          { key: 'revenueCents', label: 'Ingresos', align: 'right', render: (r: any) => formatMoney(r.revenueCents) },
        ]}
        data={campaigns}
        emptyMessage="No hay campañas UTM registradas en este periodo. Usa parámetros UTM en tus enlaces (utm_source, utm_campaign, etc.)"
      />
    </div>
  )
}

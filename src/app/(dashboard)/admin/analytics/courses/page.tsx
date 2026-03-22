'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { DataTable } from '../components/DataTable'

function formatMoney(cents: number) {
  return `€${(cents / 100).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`
}

export default function CoursesAnalyticsPage() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const to = searchParams.get('to') || new Date().toISOString().split('T')[0]

  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/analytics/courses?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((res) => setCourses(res.data || []))
      .finally(() => setLoading(false))
  }, [from, to])

  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-white/5 h-60 animate-pulse" />
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">
        Analíticas por curso
      </h3>
      <DataTable
        columns={[
          { key: 'courseTitle', label: 'Curso' },
          { key: 'pageViews', label: 'Visitas', align: 'right', render: (r: any) => r.pageViews.toLocaleString('es-ES') },
          { key: 'uniqueVisitors', label: 'Visitantes', align: 'right', render: (r: any) => r.uniqueVisitors.toLocaleString('es-ES') },
          { key: 'purchases', label: 'Compras', align: 'right', render: (r: any) => (
            <span className={r.purchases > 0 ? 'text-ap-copper font-semibold' : ''}>
              {r.purchases}
            </span>
          )},
          { key: 'revenueCents', label: 'Ingresos', align: 'right', render: (r: any) => formatMoney(r.revenueCents) },
          { key: 'conversionRate', label: 'Conversión', align: 'right', render: (r: any) => `${r.conversionRate}%` },
        ]}
        data={courses}
        emptyMessage="No hay cursos activos o datos de tráfico para este periodo"
      />
    </div>
  )
}

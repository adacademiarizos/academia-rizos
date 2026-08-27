'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { DataTable } from '../components/DataTable'
import { useDateRange } from '../components/DateRangePicker'

type CourseMetric = {
  courseId: string
  courseTitle: string
  pageViews: number
  uniqueVisitors: number
  purchases: number
  revenue: Array<{ currency: string; amountCents: number }>
  conversionRate: number
}

function formatMoney(revenue: CourseMetric['revenue']) {
  if (revenue.length === 0) return '—'
  return revenue
    .map(({ amountCents, currency }) => new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amountCents / 100))
    .join(' · ')
}

export default function CoursesAnalyticsPage() {
  const searchParams = useSearchParams()
  const { from, to, isReady } = useDateRange()
  const selectedCourseId = searchParams.get('courseId')

  const [courses, setCourses] = useState<CourseMetric[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isReady) return

    const controller = new AbortController()
    let isCurrent = true
    fetch(`/api/admin/analytics/courses?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('No fue posible cargar los cursos.')
        const result = await response.json()
        if (!isCurrent) return
        setCourses(result.data || [])
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        if (!isCurrent) return
        setError('No fue posible cargar los resultados de cursos. Inténtalo de nuevo en unos minutos.')
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => {
      isCurrent = false
      controller.abort()
    }
  }, [from, isReady, to])

  if (!isReady || loading) {
    return <div className="rounded-2xl border border-white/10 bg-white/5 h-60 animate-pulse" />
  }

  if (error) {
    return <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-5 text-sm text-amber-100">{error}</div>
  }

  const visibleCourses = selectedCourseId
    ? courses.filter((course) => course.courseId === selectedCourseId)
    : courses

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">
        {selectedCourseId ? 'Resultado del curso seleccionado' : 'Analíticas por curso'}
      </h3>
      <DataTable
        columns={[
          { key: 'courseTitle', label: 'Curso' },
          { key: 'pageViews', label: 'Visitas', align: 'right', render: (r: CourseMetric) => r.pageViews.toLocaleString('es-ES') },
          { key: 'uniqueVisitors', label: 'Visitantes', align: 'right', render: (r: CourseMetric) => r.uniqueVisitors.toLocaleString('es-ES') },
          { key: 'purchases', label: 'Compras', align: 'right', render: (r: CourseMetric) => (
            <span className={r.purchases > 0 ? 'text-ap-copper font-semibold' : ''}>
              {r.purchases}
            </span>
          )},
          { key: 'revenue', label: 'Ingresos', align: 'right', render: (r: CourseMetric) => formatMoney(r.revenue) },
          { key: 'conversionRate', label: 'Conversión', align: 'right', render: (r: CourseMetric) => `${r.conversionRate}%` },
        ]}
        data={visibleCourses}
        emptyMessage={selectedCourseId ? 'El curso no tiene datos en este período.' : 'No hay cursos activos o datos de tráfico para este período'}
      />
    </div>
  )
}

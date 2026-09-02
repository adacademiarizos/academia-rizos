'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type CourseProgressAnalytics = {
  enrolledStudents: number
  completedStudents: number
  completionRate: number
  modules: { moduleId: string; title: string; order: number; completedStudents: number }[]
  lessons: {
    lessonId: string
    title: string
    sequenceIndex: number
    moduleTitle: string | null
    reachedStudents: number
    completedStudents: number
  }[]
  dropOff: { lessonId: string | null; label: string; sequenceIndex: number | null; students: number }[]
}

const cardClass = 'rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_16px_50px_rgba(0,0,0,0.12)] sm:p-8'
const chartTooltipStyle = {
  backgroundColor: 'rgba(0,0,0,0.9)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  color: '#fff',
  fontSize: '13px',
}

/**
 * Design §D-05/D-11 (AMENDED 2026-09-01): student-progress analytics only,
 * rendered inline. No date-range control — every metric is lifetime.
 */
export function CourseAnalyticsPanel({ courseId }: { courseId: string }) {
  const [data, setData] = useState<CourseProgressAnalytics | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/courses/${courseId}/analytics`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'No se pudieron cargar las analíticas.')
      setData(body.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las analíticas.')
    }
  }, [courseId])

  useEffect(() => { void load() }, [load])

  if (error) {
    return (
      <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {error}
      </p>
    )
  }

  if (!data) {
    return <p className="text-sm text-white/50">Cargando analíticas…</p>
  }

  if (data.enrolledStudents === 0) {
    return (
      <section className={cardClass}>
        <h2 className="text-xl font-semibold text-white">Analíticas</h2>
        <p className="mt-1 text-sm text-white/50">Rendimiento de este curso.</p>
        <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/45">
          Todavía nadie tiene acceso a este curso. Las métricas aparecerán cuando haya alumnas inscritas.
        </p>
      </section>
    )
  }

  const moduleChartData = data.modules.map((m) => ({ name: m.title, completadas: m.completedStudents }))
  const lessonChartData = data.lessons.map((l) => ({
    name: l.title,
    alcanzada: l.reachedStudents,
    completada: l.completedStudents,
  }))
  const dropOffChartData = data.dropOff.map((d) => ({ name: d.label, alumnas: d.students }))

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <h2 className="text-xl font-semibold text-white">Analíticas</h2>
        <p className="mt-1 text-sm text-white/50">
          Rendimiento de este curso. Todas las métricas son acumuladas (histórico), no por período.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-widest text-white/40">Alumnas inscritas</p>
            <p className="mt-2 text-2xl font-semibold text-white">{data.enrolledStudents}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-widest text-white/40">Completaron el curso</p>
            <p className="mt-2 text-2xl font-semibold text-white">{data.completedStudents}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-widest text-white/40">Tasa de finalización</p>
            <p className="mt-2 text-2xl font-semibold text-white">{data.completionRate}%</p>
            <p className="mt-1 text-[11px] text-white/40">Según certificados emitidos</p>
          </div>
        </div>
      </section>

      {data.modules.length > 0 && (
        <section className={cardClass}>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-white/50">Progreso por módulo</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={moduleChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="completadas" name="Alumnas que completaron" fill="#B0B880" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {data.lessons.length > 0 && (
        <section className={cardClass}>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-white/50">Progreso por lección</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={lessonChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="alcanzada" name="Alcanzaron la lección" fill="#8B9060" radius={[6, 6, 0, 0]} />
              <Bar dataKey="completada" name="Completaron la lección" fill="#646A40" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {data.dropOff.length > 0 && (
        <section className={cardClass}>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-white/50">Distribución de abandono</h3>
          <p className="mt-1 text-xs text-white/40">
            Última lección que cada alumna alcanzó. &ldquo;No ha empezado&rdquo; agrupa a quienes tienen acceso pero
            aún no abrieron ninguna lección.
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dropOffChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="alumnas" name="Alumnas" fill="#B0B880" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  )
}

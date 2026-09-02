'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import CourseEditor from '../../components/CourseEditor'
import { FinalExamManager } from '../../components/FinalExamManager'
import { LearningContentManager } from '../../components/LearningContentManager'
import { CourseAttemptsPanel } from '../../components/CourseAttemptsPanel'
import { CourseAnalyticsPanel } from '../../components/CourseAnalyticsPanel'
import { ChatWidget } from '@/app/components/ChatWidget'

type TabId = 'contenido' | 'material' | 'alumnas' | 'intentos' | 'analiticas' | 'chat'

type Student = {
  user: { id: string; name: string | null; email: string | null }
  since: string
  accessUntil: string | null
  completedLessons: number
  totalLessons: number
  percentage: number
  finalEligible: boolean
  certificate: { code: string; pdfUrl: string | null; issuedAt: string } | null
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'contenido', label: 'Contenido' },
  { id: 'material', label: 'Material y examen' },
  { id: 'alumnas', label: 'Alumnas' },
  { id: 'intentos', label: 'Intentos' },
  { id: 'analiticas', label: 'Analíticas' },
  { id: 'chat', label: 'Chat del curso' },
]

const cardClass = 'rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_16px_50px_rgba(0,0,0,0.12)] sm:p-8'

export function CourseAdminTabs() {
  const params = useParams<{ courseId: string }>()
  const courseId = params.courseId
  const [tab, setTab] = useState<TabId>('contenido')

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <nav aria-label="Secciones del curso" className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-current={tab === item.id ? 'page' : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === item.id
                ? 'bg-ap-copper text-white'
                : 'text-white/60 hover:bg-white/5 hover:text-white/85'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* CourseEditor brings its own layout and its draft/publish bar, so it is
          rendered as-is instead of being nested inside another card. */}
      {tab === 'contenido' && <CourseEditor level="course" />}

      {tab === 'material' && (
        <div className="space-y-6">
          <section className={cardClass}>
            <h2 className="text-xl font-semibold text-white">Material y evaluaciones del curso</h2>
            <p className="mt-1 text-sm text-white/50">
              Recursos y evaluaciones que la alumna ve en la portada del curso, no dentro de un módulo.
            </p>
            <div className="mt-6">
              <LearningContentManager scope="COURSE" scopeId={courseId} courseId={courseId} />
            </div>
          </section>
          <FinalExamManager courseId={courseId} />
        </div>
      )}

      {tab === 'alumnas' && <StudentsPanel courseId={courseId} />}

      {tab === 'intentos' && <CourseAttemptsPanel courseId={courseId} />}

      {tab === 'analiticas' && <CourseAnalyticsPanel courseId={courseId} />}

      {tab === 'chat' && (
        <section className={cardClass}>
          <h2 className="text-xl font-semibold text-white">Chat del curso</h2>
          <p className="mt-1 text-sm text-white/50">
            Cada curso tiene su propia sala. Abrila con el botón flotante de esta pantalla.
          </p>
          <ChatWidget courseId={courseId} defaultOpen />
        </section>
      )}
    </div>
  )
}

function StudentsPanel({ courseId }: { courseId: string }) {
  const [students, setStudents] = useState<Student[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/courses/${courseId}/students`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'No se pudo cargar la lista.')
      setStudents(body.data ?? [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar la lista.')
    }
  }, [courseId])

  useEffect(() => { void load() }, [load])

  if (error) return <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
  if (!students) return <p className="text-sm text-white/50">Cargando alumnas…</p>

  return (
    <section className={cardClass}>
      <h2 className="text-xl font-semibold text-white">Alumnas con acceso</h2>
      <p className="mt-1 text-sm text-white/50">{students.length} con acceso vigente.</p>

      {students.length === 0 ? (
        <p className="mt-6 text-sm text-white/45">Todavía nadie tiene acceso a este curso.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {students.map((entry) => (
            <li key={entry.user.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-white">{entry.user.name ?? entry.user.email}</p>
                  <p className="text-xs text-white/45">{entry.user.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-white/75">
                    {entry.completedLessons}/{entry.totalLessons} lecciones · {entry.percentage}%
                  </span>
                  {entry.certificate ? (
                    <a
                      href={entry.certificate.pdfUrl ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-300"
                    >
                      Certificado {entry.certificate.code}
                    </a>
                  ) : entry.finalEligible ? (
                    <span className="rounded-full bg-ap-copper/15 px-3 py-1 font-semibold text-ap-copper">
                      Lista para el examen final
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-white/60">En curso</span>
                  )}
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-ap-copper transition-all" style={{ width: `${entry.percentage}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

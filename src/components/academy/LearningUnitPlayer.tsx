'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { ChatWidget } from '@/app/components/ChatWidget'
import { CourseAIAssistant } from '@/app/components/CourseAIAssistant'
import { ProtectedAccessNotice } from '@/app/components/ProtectedAccessNotice'
import { useCourseAccess } from '@/app/components/useCourseAccess'

type UnitType = 'module' | 'style'
type Lesson = { id: string; order: number; title: string; description: string | null; videoFileUrl: string | null }
type LearningUnit = { id: string; order: number; title: string; description: string | null; videoFileUrl?: string | null; completed?: boolean; lessonCount?: number }

export function LearningUnitPlayer({ unitType }: { unitType: UnitType }) {
  const params = useParams()
  const courseId = params.courseId as string
  const unitId = (unitType === 'module' ? params.moduleId : params.styleId) as string
  const access = useCourseAccess(courseId)
  const [courseName, setCourseName] = useState('')
  const [unit, setUnit] = useState<LearningUnit | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [savingProgress, setSavingProgress] = useState(false)

  useEffect(() => {
    if (access.loading || !access.hasAccess) return
    const load = async () => {
      try {
        const [courseResponse, contentResponse] = await Promise.all([
          fetch(`/api/courses/${courseId}`),
          fetch(`/api/courses/${courseId}/modules`),
        ])
        if (!courseResponse.ok || !contentResponse.ok) throw new Error('No se pudo cargar el contenido del curso')
        const [courseData, contentData] = await Promise.all([courseResponse.json(), contentResponse.json()])
        const sections = unitType === 'module' ? contentData.data.modules : contentData.data.styles
        const current = sections.find((section: LearningUnit) => section.id === unitId)
        if (!current) throw new Error(unitType === 'module' ? 'Módulo no encontrado' : 'Estilo no encontrado')

        const lessonsResponse = await fetch(
          unitType === 'module'
            ? `/api/student/modules/${unitId}/lessons`
            : `/api/student/styles/${unitId}/lessons`
        )
        if (!lessonsResponse.ok) throw new Error('No se pudieron cargar las lecciones')
        const lessonsData = await lessonsResponse.json()

        setCourseName(courseData.data.title)
        setUnit(current)
        setLessons(lessonsData.data)
        setActiveLessonId(lessonsData.data[0]?.id ?? null)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No se pudo cargar el contenido')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [access.hasAccess, access.loading, courseId, unitId, unitType])

  const activeLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === activeLessonId) ?? null,
    [activeLessonId, lessons]
  )
  const videoSource = activeLesson?.videoFileUrl ?? unit?.videoFileUrl ?? null

  async function setCompleted() {
    setSavingProgress(true)
    try {
      const response = await fetch(
        unitType === 'module' ? `/api/modules/${unitId}/progress` : `/api/styles/${unitId}/progress`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: true }) }
      )
      if (!response.ok) throw new Error('No se pudo guardar tu progreso')
      setUnit((current) => current ? { ...current, completed: true } : current)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar tu progreso')
    } finally {
      setSavingProgress(false)
    }
  }

  if (access.loading || (access.hasAccess && loading)) {
    return <main className="min-h-screen bg-ap-ink px-6 py-12 text-center text-ap-ivory">Cargando contenido...</main>
  }
  if (access.reason) {
    return <ProtectedAccessNotice reason={access.reason} from={`/learn/${courseId}`} showSignIn={access.reason === 'SIGN_IN_REQUIRED'} />
  }
  if (access.error || error || !unit) {
    return (
      <main className="min-h-screen bg-ap-ink px-6 py-12 text-ap-ivory">
        <div className="mx-auto max-w-4xl space-y-5"><p>{access.error || error}</p><Link href={`/learn/${courseId}`} className="text-ap-copper underline">Volver al curso</Link></div>
      </main>
    )
  }

  const kind = unitType === 'module' ? 'Módulo' : 'Estilo'
  return (
    <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black">
      <header className="sticky top-16 z-10 border-b border-zinc-800 bg-ap-ink/95 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto max-w-screen-xl">
          <Link href={`/learn/${courseId}`} className="text-sm text-zinc-400 transition hover:text-ap-copper">← {courseName}</Link>
          <h1 className="mt-1 text-xl font-bold text-ap-ivory">{kind} {unit.order + 1}: {unit.title}</h1>
        </div>
      </header>

      <div className="mx-auto grid max-w-screen-xl gap-8 px-6 py-10 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="h-fit rounded-3xl border border-zinc-700 bg-white/5 p-4 lg:sticky lg:top-36">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Lecciones</p>
          <div className="space-y-1">
            {lessons.length === 0 && <p className="px-3 py-4 text-sm text-zinc-500">Aún no hay lecciones.</p>}
            {lessons.map((lesson) => (
              <button key={lesson.id} onClick={() => setActiveLessonId(lesson.id)} className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${lesson.id === activeLessonId ? 'border border-ap-copper/30 bg-ap-copper/15 text-ap-ivory' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}>
                <span className="w-5 shrink-0 text-center text-xs font-bold text-ap-copper">{lesson.order + 1}</span><span>{lesson.title}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-8">
          <div className="overflow-hidden rounded-3xl border border-zinc-700 bg-black shadow-2xl">
            <div className="aspect-video flex items-center justify-center">
              {videoSource ? <video key={videoSource} src={videoSource} controls className="h-full w-full" /> : <p className="text-sm text-zinc-500">Sin video disponible</p>}
            </div>
          </div>
          <article className="rounded-3xl border border-zinc-700 bg-white/5 p-7 sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ap-copper">{activeLesson ? 'Lección' : kind}</p>
            <h2 className="mt-3 text-2xl font-bold text-ap-ivory">{activeLesson?.title ?? unit.title}</h2>
            <p className="mt-4 whitespace-pre-wrap leading-relaxed text-zinc-300">{activeLesson?.description ?? unit.description ?? 'Sin descripción.'}</p>
          </article>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-700 bg-white/5 p-5">
            <span className={unit.completed ? 'text-sm font-medium text-ap-copper' : 'text-sm text-zinc-400'}>{unit.completed ? '✓ Completado' : 'En progreso'}</span>
            {!unit.completed && <button onClick={setCompleted} disabled={savingProgress} className="rounded-xl bg-ap-copper px-5 py-3 text-sm font-semibold text-ap-ink transition hover:bg-ap-copper/90 disabled:opacity-60">{savingProgress ? 'Guardando...' : `Marcar ${kind.toLowerCase()} como completado`}</button>}
          </div>
        </section>
      </div>
      <CourseAIAssistant courseId={courseId} courseName={courseName} moduleId={unitType === 'module' ? unitId : undefined} />
      <ChatWidget courseId={courseId} />
    </main>
  )
}

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { ChatWidget } from '@/app/components/ChatWidget'
import { CourseAIAssistant } from '@/app/components/CourseAIAssistant'
import { ProtectedAccessNotice } from '@/app/components/ProtectedAccessNotice'
import { useCourseAccess } from '@/app/components/useCourseAccess'
import { VideoPlayer } from '@/components/academy/VideoPlayer'

type UnitType = 'module' | 'style'
type Lesson = { id: string; order: number; title: string; description: string | null; videoFileUrl: string | null }
type LearningUnit = { id: string; order: number; title: string; description: string | null; videoFileUrl?: string | null; completed?: boolean; lessonCount?: number }
type LearningProgress = {
  lessons: { id: string; completed: boolean }[]
}

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
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set())
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loadingVideo, setLoadingVideo] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [lessonNotice, setLessonNotice] = useState<string | null>(null)

  const refreshProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/student/courses/${courseId}/learning-progress`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      const progress: LearningProgress = json.data
      setCompletedLessonIds(new Set(progress.lessons.filter((l) => l.completed).map((l) => l.id)))
    } catch {
      // Progress is a nice-to-have overlay — ignore failures.
    }
  }, [courseId])

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
        void refreshProgress()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No se pudo cargar el contenido')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [access.hasAccess, access.loading, courseId, unitId, unitType, refreshProgress])

  const activeLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === activeLessonId) ?? null,
    [activeLessonId, lessons]
  )
  const activeLessonIndex = useMemo(
    () => lessons.findIndex((lesson) => lesson.id === activeLessonId),
    [lessons, activeLessonId]
  )
  const nextLesson = activeLessonIndex >= 0 && activeLessonIndex < lessons.length - 1 ? lessons[activeLessonIndex + 1] : null
  const unitProgressPercent =
    lessons.length > 0
      ? Math.round((lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length / lessons.length) * 100)
      : null

  useEffect(() => {
    if (!activeLesson && !(lessons.length === 0 && unit?.videoFileUrl)) {
      setVideoUrl(null)
      setLoadingVideo(false)
      return
    }
    let cancelled = false
    setLoadingVideo(true)
    setLessonNotice(null)
    const endpoint = activeLesson
      ? `/api/student/lessons/${activeLesson.id}/video-url`
      : `/api/student/modules/${unitId}/video-url`

    fetch(endpoint, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('video fetch failed'))))
      .then((json) => {
        if (!cancelled) setVideoUrl(json.data?.videoUrl ?? null)
      })
      .catch(() => {
        if (!cancelled) setVideoUrl(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingVideo(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeLesson, lessons.length, unit?.videoFileUrl, unitId])

  const selectLesson = (lessonId: string) => {
    setActiveLessonId(lessonId)
    setMobileSidebarOpen(false)
    setLessonNotice(null)
  }

  async function markLessonViewed(lessonId: string) {
    setLessonNotice(null)
    try {
      const response = await fetch(`/api/student/lessons/${lessonId}/complete`, { method: 'POST' })
      const json = await response.json().catch(() => null)
      if (!response.ok) {
        if (json?.code === 'LESSON_REQUIREMENTS_PENDING') {
          setLessonNotice('Aprueba las evaluaciones obligatorias de esta lección para marcarla como completada.')
        }
        return
      }
      await refreshProgress()
    } catch {
      // Best-effort — the lesson stays unmarked and the student can retry.
    }
  }

  const goToNextLesson = () => {
    if (!nextLesson) return
    selectLesson(nextLesson.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
  const activeIsCompleted = activeLesson ? completedLessonIds.has(activeLesson.id) : false

  const lessonList = (
    <div className="p-4 lg:p-0">
      {unitProgressPercent !== null && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Progreso</span>
            <span className="font-semibold text-ap-copper">{unitProgressPercent}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-ap-copper to-ap-olive transition-all duration-500"
              style={{ width: `${unitProgressPercent}%` }}
            />
          </div>
        </div>
      )}
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Lecciones</p>
      <div className="space-y-1">
        {lessons.length === 0 && <p className="px-3 py-4 text-sm text-zinc-500">Aún no hay lecciones.</p>}
        {lessons.map((lesson) => {
          const isActive = lesson.id === activeLessonId
          const isDone = completedLessonIds.has(lesson.id)
          return (
            <button
              key={lesson.id}
              onClick={() => selectLesson(lesson.id)}
              className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${isActive ? 'border border-ap-copper/30 bg-ap-copper/15 text-ap-ivory' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
            >
              <span
                className={`mt-0.5 flex w-5 h-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  isDone
                    ? 'bg-ap-copper text-ap-ink'
                    : isActive
                    ? 'border border-ap-copper text-ap-copper'
                    : 'border border-zinc-600 text-zinc-600'
                }`}
              >
                {isDone ? '✓' : lesson.order + 1}
              </span>
              <span>{lesson.title}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black">
      <header className="sticky top-16 z-10 border-b border-zinc-800 bg-ap-ink/95 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-4">
          <div className="min-w-0">
            <Link href={`/learn/${courseId}`} className="text-sm text-zinc-400 transition hover:text-ap-copper">← {courseName}</Link>
            <h1 className="mt-1 truncate text-xl font-bold text-ap-ivory">{kind} {unit.order + 1}: {unit.title}</h1>
          </div>
          {lessons.length > 0 && (
            <button
              onClick={() => setMobileSidebarOpen((v) => !v)}
              className="lg:hidden shrink-0 flex items-center gap-2 rounded-lg border border-zinc-700 bg-white/5 px-3 py-2 text-sm text-zinc-300"
            >
              {unitProgressPercent !== null && <span className="font-semibold text-ap-copper">{unitProgressPercent}%</span>}
              Lecciones
              <span className={`transition-transform ${mobileSidebarOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>
          )}
        </div>
      </header>

      {mobileSidebarOpen && lessons.length > 0 && (
        <div className="lg:hidden max-h-[70vh] overflow-y-auto nav-scroll border-b border-zinc-700 bg-white/5">
          {lessonList}
        </div>
      )}

      <div className="mx-auto grid max-w-screen-xl gap-8 px-6 py-10 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block h-fit rounded-3xl border border-zinc-700 bg-white/5 p-4 lg:sticky lg:top-36">
          {lessonList}
        </aside>

        <section className="space-y-8">
          <div className="overflow-hidden rounded-3xl border border-zinc-700 bg-black shadow-2xl">
            <div className="aspect-video flex items-center justify-center">
              {loadingVideo ? (
                <p className="text-sm text-zinc-500">Cargando video...</p>
              ) : videoUrl ? (
                <VideoPlayer key={activeLesson?.id ?? unitId} src={videoUrl} />
              ) : (
                <p className="text-sm text-zinc-500">Sin video disponible</p>
              )}
            </div>
          </div>

          {activeLesson && (
            <div className="flex flex-wrap items-center gap-3">
              {!activeIsCompleted ? (
                <button
                  onClick={() => markLessonViewed(activeLesson.id)}
                  className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/15"
                >
                  Marcar lección como vista
                </button>
              ) : (
                <span className="rounded-lg bg-ap-copper/15 px-4 py-2 text-sm font-medium text-ap-copper">✓ Lección completada</span>
              )}
              {nextLesson && (
                <button
                  onClick={goToNextLesson}
                  className="rounded-lg bg-ap-copper px-4 py-2 text-sm font-semibold text-ap-ink transition hover:bg-ap-copper/90"
                >
                  Siguiente lección →
                </button>
              )}
              {lessonNotice && <p className="w-full text-xs text-zinc-400">{lessonNotice}</p>}
            </div>
          )}

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

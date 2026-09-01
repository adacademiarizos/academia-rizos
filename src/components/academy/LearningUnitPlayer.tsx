'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { ChatWidget } from '@/app/components/ChatWidget'
import { CourseAIAssistant } from '@/app/components/CourseAIAssistant'
import { AI_ASSISTANT_ENABLED } from '@/lib/feature-flags'
import { LearningAssessmentPanel } from '@/app/components/LearningAssessmentPanel'
import { ProtectedAccessNotice } from '@/app/components/ProtectedAccessNotice'
import { useCourseAccess } from '@/app/components/useCourseAccess'
import { VideoPlayer } from '@/components/academy/VideoPlayer'

type UnitType = 'module' | 'style'
type Lesson = { id: string; order: number; title: string; description: string | null; videoFileUrl: string | null; completed?: boolean }
type Resource = { id: string; title: string; fileUrl: string; fileType: string; fileSize: number }
/** Modules expose `title`, styles expose `name`; the player accepts either. */
type LearningUnit = { id: string; order: number; title?: string; name?: string; description: string | null; videoFileUrl?: string | null; completed?: boolean; lessonCount?: number }

function ResourceList({ title, resources }: { title: string; resources: Resource[] }) {
  return (
    <section className="rounded-3xl border border-zinc-700 bg-white/5 p-7 sm:p-9">
      <h3 className="text-lg font-bold text-ap-ivory">{title}</h3>
      <div className="mt-5 space-y-2">
        {resources.map((resource) => (
          <a key={resource.id} href={resource.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-zinc-700 bg-black/20 p-4 text-sm text-zinc-200 transition hover:border-ap-copper hover:text-ap-ivory">
            <span className="min-w-0 flex-1 truncate">{resource.title}</span>
            <span className="shrink-0 text-xs text-zinc-500">{Math.max(1, Math.round(resource.fileSize / 1024))} KB</span>
          </a>
        ))}
      </div>
    </section>
  )
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
  const [unitResources, setUnitResources] = useState<Resource[]>([])
  const [lessonResources, setLessonResources] = useState<Resource[]>([])
  const [unitAssessmentCount, setUnitAssessmentCount] = useState(0)
  // The sidebar navigates between the lessons and the unit-wide sections, so the
  // main column renders one of them at a time instead of stacking everything.
  const [view, setView] = useState<'lesson' | 'unit-content' | 'unit-tests'>('lesson')
  const [savingProgress, setSavingProgress] = useState(false)
  // Course videos live in a private bucket, so the URL is minted per request
  // after the server re-checks the student's access instead of being embedded.
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loadingVideo, setLoadingVideo] = useState(false)

  // The server refuses when a required lesson assessment is still pending, so
  // the button is always offered and the refusal explains why.
  async function completeLesson(lessonId: string) {
    setSavingProgress(true)
    setError(null)
    try {
      const response = await fetch(`/api/student/lessons/${lessonId}/progress`, { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar tu progreso')
      setLessons((current) => current.map((lesson) => lesson.id === lessonId ? { ...lesson, completed: true } : lesson))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar tu progreso')
    } finally {
      setSavingProgress(false)
    }
  }

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

        const scope = unitType === 'module' ? 'MODULE' : 'STYLE'
        const [unitResourcesResponse, unitAssessmentsResponse] = await Promise.all([
          fetch(`/api/student/learning/${scope}/${unitId}/resources`),
          fetch(`/api/student/learning/${scope}/${unitId}/assessments`),
        ])
        setUnitResources(unitResourcesResponse.ok ? (await unitResourcesResponse.json()).data ?? [] : [])
        setUnitAssessmentCount(unitAssessmentsResponse.ok ? ((await unitAssessmentsResponse.json()).data ?? []).length : 0)

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

  // Resources and tests hang off the lesson, so they reload whenever the
  // student switches lessons in the sidebar.
  useEffect(() => {
    if (!activeLessonId) { setLessonResources([]); return }
    let cancelled = false
    const loadLessonContent = async () => {
      const resourcesResponse = await fetch(`/api/student/learning/LESSON/${activeLessonId}/resources`)
      if (cancelled) return
      setLessonResources(resourcesResponse.ok ? (await resourcesResponse.json()).data ?? [] : [])
    }
    void loadLessonContent()
    return () => { cancelled = true }
  }, [activeLessonId])

  const activeLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === activeLessonId) ?? null,
    [activeLessonId, lessons]
  )
  const hasVideo = Boolean(activeLesson?.videoFileUrl ?? unit?.videoFileUrl)
  const completedCount = lessons.filter((lesson) => lesson.completed).length
  const unitName = unit?.title ?? unit?.name ?? ''

  // Signed URLs expire, so they are fetched per lesson rather than up front
  // with the rest of the unit.
  useEffect(() => {
    if (!hasVideo) { setVideoUrl(null); setLoadingVideo(false); return }
    let cancelled = false
    setLoadingVideo(true)
    const endpoint = activeLesson
      ? `/api/student/lessons/${activeLesson.id}/video-url`
      : `/api/student/modules/${unitId}/video-url`
    const loadVideo = async () => {
      try {
        const response = await fetch(endpoint, { cache: 'no-store' })
        if (!response.ok) throw new Error('No se pudo cargar el video')
        const payload = await response.json()
        if (!cancelled) setVideoUrl(payload.data?.videoUrl ?? null)
      } catch {
        if (!cancelled) setVideoUrl(null)
      } finally {
        if (!cancelled) setLoadingVideo(false)
      }
    }
    void loadVideo()
    return () => { cancelled = true }
  }, [activeLesson, hasVideo, unitId])

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
          <h1 className="mt-1 text-xl font-bold text-ap-ivory">{kind} {unit.order + 1}: {unitName}</h1>
        </div>
      </header>

      <div className="mx-auto grid max-w-screen-xl gap-8 px-6 py-10 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="h-fit rounded-3xl border border-zinc-700 bg-white/5 p-4 lg:sticky lg:top-36">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Lecciones</p>
          <div className="space-y-1">
            {lessons.length === 0 && <p className="px-3 py-4 text-sm text-zinc-500">Aún no hay lecciones.</p>}
            {lessons.map((lesson) => (
              <button key={lesson.id} onClick={() => { setActiveLessonId(lesson.id); setView('lesson') }} className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${view === 'lesson' && lesson.id === activeLessonId ? 'border border-ap-copper/30 bg-ap-copper/15 text-ap-ivory' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}>
                <span className="w-5 shrink-0 text-center text-xs font-bold text-ap-copper">{lesson.completed ? '\u2713' : lesson.order + 1}</span><span className="flex-1">{lesson.title}</span>
              </button>
            ))}
          </div>

          {(unitResources.length > 0 || unitAssessmentCount > 0) && (
            <>
              <p className="mb-3 mt-6 border-t border-zinc-700 pt-5 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                {unitType === 'module' ? 'Del módulo' : 'Del estilo'}
              </p>
              <div className="space-y-1">
                {unitResources.length > 0 && (
                  <button onClick={() => setView('unit-content')} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${view === 'unit-content' ? 'border border-ap-copper/30 bg-ap-copper/15 text-ap-ivory' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}>
                    <span className="flex-1">Contenido</span>
                    <span className="shrink-0 text-xs text-zinc-500">{unitResources.length}</span>
                  </button>
                )}
                {unitAssessmentCount > 0 && (
                  <button onClick={() => setView('unit-tests')} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${view === 'unit-tests' ? 'border border-ap-copper/30 bg-ap-copper/15 text-ap-ivory' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}>
                    <span className="flex-1">Evaluaciones</span>
                    <span className="shrink-0 text-xs text-zinc-500">{unitAssessmentCount}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </aside>

        <section className="space-y-8">
          {view === 'unit-content' && (
            <>
              <article className="rounded-3xl border border-zinc-700 bg-white/5 p-7 sm:p-9">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ap-copper">{unitType === 'module' ? 'Módulo' : 'Estilo'}</p>
                <h2 className="mt-3 text-2xl font-bold text-ap-ivory">{unitName}</h2>
                <p className="mt-4 whitespace-pre-wrap leading-relaxed text-zinc-300">{unit.description ?? 'Sin descripción.'}</p>
              </article>
              <ResourceList title={`Material ${unitType === 'module' ? 'del módulo' : 'del estilo'}`} resources={unitResources} />
            </>
          )}

          {view === 'unit-tests' && (
            <LearningAssessmentPanel
              scope={unitType === 'module' ? 'MODULE' : 'STYLE'}
              scopeId={unitId}
              courseId={courseId}
              title={`Evaluaciones ${unitType === 'module' ? 'del módulo' : 'del estilo'}`}
            />
          )}

          {view === 'lesson' && (
            <>
              {/* No placeholder when there is no video: an empty black box reads
                  as something that failed to load. */}
              {hasVideo && (
                <div className="overflow-hidden rounded-3xl border border-zinc-700 bg-black shadow-2xl">
                  <div className="aspect-video flex items-center justify-center">
                    {loadingVideo ? (
                      <p className="text-sm text-zinc-500">Cargando video...</p>
                    ) : videoUrl ? (
                      <VideoPlayer key={activeLesson?.id ?? unitId} src={videoUrl} />
                    ) : (
                      <p className="text-sm text-zinc-500">No se pudo cargar el video</p>
                    )}
                  </div>
                </div>
              )}
              <article className="rounded-3xl border border-zinc-700 bg-white/5 p-7 sm:p-9">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ap-copper">{activeLesson ? 'Lección' : kind}</p>
                <h2 className="mt-3 text-2xl font-bold text-ap-ivory">{activeLesson?.title ?? unitName}</h2>
                <p className="mt-4 whitespace-pre-wrap leading-relaxed text-zinc-300">{activeLesson?.description ?? unit.description ?? 'Sin descripción.'}</p>
              </article>

              {lessonResources.length > 0 && <ResourceList title="Material de esta lección" resources={lessonResources} />}

              {activeLessonId && (
                <LearningAssessmentPanel
                  key={activeLessonId}
                  scope="LESSON"
                  scopeId={activeLessonId}
                  courseId={courseId}
                  title="Evaluaciones de esta lección"
                />
              )}

              {/* Without this the refusal ("aprobá las evaluaciones primero") was
                  stored in state and never shown: the button just did nothing. */}
              {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-700 bg-white/5 p-5">
                <span className={activeLesson?.completed ? 'text-sm font-medium text-ap-copper' : 'text-sm text-zinc-400'}>
                  {!activeLesson ? `${completedCount} de ${lessons.length} lecciones completadas` : activeLesson.completed ? '\u2713 Lección completada' : `Lección en progreso - ${completedCount} de ${lessons.length} completadas`}
                </span>
                {activeLesson && !activeLesson.completed && (
                  <button onClick={() => completeLesson(activeLesson.id)} disabled={savingProgress} className="rounded-xl bg-ap-copper px-5 py-3 text-sm font-semibold text-ap-ink transition hover:bg-ap-copper/90 disabled:opacity-60">
                    {savingProgress ? 'Guardando…' : 'Marcar lección como completada'}
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
      {AI_ASSISTANT_ENABLED && <CourseAIAssistant courseId={courseId} courseName={courseName} moduleId={unitType === 'module' ? unitId : undefined} />}
      <ChatWidget courseId={courseId} />
    </main>
  )
}

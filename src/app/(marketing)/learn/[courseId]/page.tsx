'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ChatWidget } from '@/app/components/ChatWidget'
import { CourseAIAssistant } from '@/app/components/CourseAIAssistant'
import { AI_ASSISTANT_ENABLED } from '@/lib/feature-flags'
import { FinalExamPanel } from '@/app/components/FinalExamPanel'
import { LearningAssessmentPanel } from '@/app/components/LearningAssessmentPanel'
import { ProtectedAccessNotice } from '@/app/components/ProtectedAccessNotice'
import { useCourseAccess } from '@/app/components/useCourseAccess'
import type { Course } from '@/types/academy'

type Module = { id: string; title: string; order: number; description?: string | null; completed?: boolean }
type Style = { id: string; name: string; order: number; description?: string | null; lessonCount: number; completed?: boolean }
type CourseTestItem = { id: string; title: string; description: string | null; isFinalExam: boolean; _count: { questions: number } }
type DashboardData = { course: Course; modules: Module[]; styles: Style[]; progress: number; courseTests: CourseTestItem[] }

function Status({ completed }: { completed?: boolean }) {
  return <span className={completed ? 'text-sm font-medium text-ap-copper' : 'text-sm text-zinc-400'}>{completed ? '✓ Completado' : 'Pendiente'}</span>
}

export default function LearningDashboard() {
  const courseId = useParams().courseId as string
  const access = useCourseAccess(courseId)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [courseResources, setCourseResources] = useState<Array<{ id: string; title: string; fileUrl: string; fileSize: number }>>([])

  useEffect(() => {
    if (access.loading || !access.hasAccess) return
    const load = async () => {
      try {
        const [courseResponse, contentResponse, testsResponse, progressResponse, resourcesResponse] = await Promise.all([
          fetch(`/api/courses/${courseId}`),
          fetch(`/api/courses/${courseId}/modules`),
          fetch(`/api/student/courses/${courseId}/tests`),
          fetch(`/api/student/courses/${courseId}/learning-progress`),
          fetch(`/api/student/learning/COURSE/${courseId}/resources`),
        ])
        if (!courseResponse.ok || !contentResponse.ok) throw new Error('No se pudo cargar el curso')
        const [coursePayload, contentPayload] = await Promise.all([courseResponse.json(), contentResponse.json()])
        const testsPayload = testsResponse.ok ? await testsResponse.json() : { data: [] }
        // learning-progress is the authoritative source: a module or style only
        // counts as completed when its lessons AND its required assessments are
        // done. The content endpoint only knows about lessons.
        const progressPayload = progressResponse.ok ? await progressResponse.json() : null
        setCourseResources(resourcesResponse.ok ? (await resourcesResponse.json()).data ?? [] : [])
        const completedById = new Map<string, boolean>(
          [...(progressPayload?.data?.modules ?? []), ...(progressPayload?.data?.styles ?? [])]
            .map((entry: { id: string; completed: boolean }) => [entry.id, entry.completed])
        )
        const withProgress = <T extends { id: string; completed?: boolean }>(items: T[]) =>
          items.map((item) => ({ ...item, completed: completedById.get(item.id) ?? item.completed ?? false }))

        setData({
          course: coursePayload.data,
          modules: withProgress(contentPayload.data.modules ?? []),
          styles: withProgress(contentPayload.data.styles ?? []),
          progress: progressPayload?.data?.percentage ?? contentPayload.data.progress ?? 0,
          courseTests: testsPayload.data ?? [],
        })
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No se pudo cargar el curso')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [access.hasAccess, access.loading, courseId])

  if (access.loading || (access.hasAccess && loading)) return <main className="min-h-screen bg-ap-ink px-6 py-12 text-center text-ap-ivory">Cargando curso...</main>
  if (access.reason) return <ProtectedAccessNotice reason={access.reason} from={`/learn/${courseId}`} showSignIn={access.reason === 'SIGN_IN_REQUIRED'} />
  if (access.error || error || !data) return <main className="min-h-screen bg-ap-ink px-6 py-12 text-ap-ivory"><div className="mx-auto max-w-4xl space-y-5"><p>{access.error || error}</p><Link href="/courses" className="text-ap-copper underline">Volver a cursos</Link></div></main>

  const completed = data.modules.filter((module) => module.completed).length + data.styles.filter((style) => style.completed).length
  const sectionCount = data.modules.length + data.styles.length
  return (
    <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black">
      <header className="sticky top-16 z-10 border-b border-zinc-800 bg-ap-ink/95 px-6 py-5 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl"><Link href="/courses" className="text-sm text-zinc-400 transition hover:text-ap-copper">← Volver a cursos</Link><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><h1 className="text-2xl font-bold text-ap-ivory">{data.course.title}</h1><p className="text-sm font-semibold text-ap-copper">{data.progress}% completado</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-ap-copper to-ap-olive transition-all" style={{ width: `${data.progress}%` }} /></div></div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-10">
          {data.modules.length > 0 && <div className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ap-copper">Estructura</p><h2 className="mt-2 text-xl font-bold text-ap-ivory">Módulos</h2></div>{data.modules.map((module) => <Link key={module.id} href={`/learn/${courseId}/modules/${module.id}`} className="block rounded-2xl border border-zinc-700 bg-white/5 p-6 transition hover:border-ap-copper hover:bg-white/10"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ap-copper/15 font-bold text-ap-copper">{module.order + 1}</span><div className="min-w-0 flex-1"><h3 className="font-semibold text-ap-ivory">{module.title}</h3>{module.description && <p className="mt-1 text-sm text-zinc-400">{module.description}</p>}</div><Status completed={module.completed} /></div></Link>)}</div>}
          {data.styles.length > 0 && <div className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ap-olive">Estructura</p><h2 className="mt-2 text-xl font-bold text-ap-ivory">Estilos</h2></div>{data.styles.map((style) => <Link key={style.id} href={`/learn/${courseId}/styles/${style.id}`} className="block rounded-2xl border border-zinc-700 bg-white/5 p-6 transition hover:border-ap-copper hover:bg-white/10"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ap-olive/15 font-bold text-ap-olive">{style.order + 1}</span><div className="min-w-0 flex-1"><h3 className="font-semibold text-ap-ivory">{style.name}</h3><p className="mt-1 text-sm text-zinc-400">{style.lessonCount} lección{style.lessonCount !== 1 ? 'es' : ''}{style.description ? ` · ${style.description}` : ''}</p></div><Status completed={style.completed} /></div></Link>)}</div>}
          {data.courseTests.length > 0 && <div className="space-y-4 border-t border-zinc-700 pt-10"><h2 className="text-xl font-bold text-ap-ivory">Tests y evaluaciones</h2>{data.courseTests.map((test) => <Link key={test.id} href={`/learn/${courseId}/tests/${test.id}`} className="block rounded-2xl border border-zinc-700 bg-white/5 p-5 transition hover:border-ap-copper"><h3 className="font-semibold text-ap-ivory">{test.title}{test.isFinalExam ? ' · Examen final' : ''}</h3>{test.description && <p className="mt-1 text-sm text-zinc-400">{test.description}</p>}<p className="mt-2 text-xs text-zinc-500">{test._count.questions} preguntas</p></Link>)}</div>}
          {/* Course-scoped material and assessments were written by the admin
              but never rendered here, so the student never saw them. */}
          {courseResources.length > 0 && (
            <div className="space-y-4 border-t border-zinc-700 pt-10">
              <h2 className="text-xl font-bold text-ap-ivory">Material del curso</h2>
              <div className="space-y-2">
                {courseResources.map((resource) => (
                  <a key={resource.id} href={resource.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-zinc-700 bg-white/5 p-4 text-sm text-zinc-200 transition hover:border-ap-copper hover:text-ap-ivory">
                    <span className="min-w-0 flex-1 truncate">{resource.title}</span>
                    <span className="shrink-0 text-xs text-zinc-500">{Math.max(1, Math.round(resource.fileSize / 1024))} KB</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <LearningAssessmentPanel scope="COURSE" scopeId={courseId} courseId={courseId} title="Evaluaciones del curso" />

          {/* The final exam lives on its own model and API; without this the
              panel existed but was never mounted, so students could not take it. */}
          <FinalExamPanel courseId={courseId} />
        </section>
        <aside className="space-y-6"><section className="rounded-2xl border border-zinc-700 bg-white/5 p-6"><h2 className="font-bold text-ap-ivory">Tu progreso</h2><dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><dt className="text-zinc-400">Secciones</dt><dd className="text-ap-copper">{sectionCount}</dd></div><div className="flex justify-between"><dt className="text-zinc-400">Completadas</dt><dd className="text-ap-copper">{completed}</dd></div><div className="flex justify-between"><dt className="text-zinc-400">Progreso</dt><dd className="text-ap-copper">{data.progress}%</dd></div></dl></section><section className="rounded-2xl border border-zinc-700 bg-white/5 p-6"><h2 className="font-bold text-ap-ivory">Sobre el curso</h2><p className="mt-3 text-sm leading-relaxed text-zinc-300">{data.course.description || 'Sin descripción.'}</p></section></aside>
      </div>
      {AI_ASSISTANT_ENABLED && <CourseAIAssistant courseId={courseId} courseName={data.course.title} />}<ChatWidget courseId={courseId} defaultOpen />
    </main>
  )
}

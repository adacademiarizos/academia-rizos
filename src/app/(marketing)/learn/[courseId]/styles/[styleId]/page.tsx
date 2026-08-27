'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { LearningAssessmentPanel } from '@/app/components/LearningAssessmentPanel'
import { LearningResourcesPanel } from '@/app/components/LearningResourcesPanel'
import { ProtectedAccessNotice } from '@/app/components/ProtectedAccessNotice'
import { useCourseAccess } from '@/app/components/useCourseAccess'

type Lesson = {
  id: string
  order: number
  title: string
  description: string | null
  videoUrl: string | null
  videoFileUrl: string | null
  transcript: string | null
}

type Style = {
  id: string
  name: string
  description: string | null
  lessons: Lesson[]
}

export default function StylePlayer() {
  const params = useParams()
  const courseId = params.courseId as string
  const styleId = params.styleId as string
  const access = useCourseAccess(courseId)
  const [style, setStyle] = useState<Style | null>(null)
  const [courseTitle, setCourseTitle] = useState('Curso')
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (access.loading || !access.hasAccess) return
    const load = async () => {
      try {
        const [courseResponse, stylesResponse, progressResponse] = await Promise.all([
          fetch(`/api/courses/${courseId}`),
          fetch(`/api/student/courses/${courseId}/styles`),
          fetch(`/api/student/courses/${courseId}/learning-progress`),
        ])
        if (!stylesResponse.ok) throw new Error('No se pudieron cargar los estilos.')
        const stylesBody = await stylesResponse.json()
        const current = (stylesBody.data as Style[]).find((item) => item.id === styleId)
        if (!current) throw new Error('Estilo no encontrado.')
        setStyle(current)
        setActiveLessonId(current.lessons[0]?.id ?? null)
        if (courseResponse.ok) setCourseTitle((await courseResponse.json()).data.title)
        if (progressResponse.ok) {
          const progress = (await progressResponse.json()).data
          setCompleted(new Set((progress.lessons ?? []).filter((lesson: { completed: boolean }) => lesson.completed).map((lesson: { id: string }) => lesson.id)))
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo cargar el estilo.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [access.hasAccess, access.loading, courseId, styleId])

  const markLessonCompleted = async (lessonId: string) => {
    setMessage(null)
    const response = await fetch(`/api/student/lessons/${lessonId}/complete`, { method: 'POST' })
    const body = await response.json()
    if (!response.ok) {
      setMessage(body.error ?? 'No se pudo completar la lección.')
      return
    }
    setCompleted((current) => new Set([...current, lessonId]))
    setMessage('Lección completada.')
  }

  if (access.loading || (access.hasAccess && loading)) return <main className="min-h-screen bg-ap-ink px-6 py-10 text-center text-ap-ivory">Cargando estilo...</main>
  if (access.reason) return <ProtectedAccessNotice reason={access.reason} from={`/learn/${courseId}/styles/${styleId}`} showSignIn={access.reason === 'SIGN_IN_REQUIRED'} />
  if (access.error || message && !style) return <main className="min-h-screen bg-ap-ink px-6 py-10 text-center text-red-300">{access.error ?? message}</main>
  if (!style) return null

  const activeLesson = style.lessons.find((lesson) => lesson.id === activeLessonId) ?? null
  const videoUrl = activeLesson?.videoFileUrl || activeLesson?.videoUrl

  return <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black text-white">
    <header className="sticky top-16 z-10 border-b border-zinc-800 bg-ap-ink/95 px-6 py-4 backdrop-blur-sm">
      <div className="mx-auto max-w-screen-xl"><Link href={`/learn/${courseId}`} className="text-sm text-zinc-400 hover:text-ap-copper">← {courseTitle}</Link><h1 className="mt-1 text-xl font-bold">Estilo: {style.name}</h1></div>
    </header>
    <div className="mx-auto flex max-w-screen-xl flex-col lg:flex-row">
      <aside className="w-full shrink-0 border-b border-zinc-800 bg-black/10 p-4 lg:w-80 lg:border-b-0 lg:border-r">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Lecciones</p>
        <div className="space-y-1">
          {style.lessons.map((lesson) => <button key={lesson.id} type="button" onClick={() => setActiveLessonId(lesson.id)} className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${lesson.id === activeLessonId ? 'border border-ap-copper/30 bg-ap-copper/15 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}><span className="w-5 text-center text-xs font-bold text-ap-copper">{completed.has(lesson.id) ? '✓' : lesson.order + 1}</span><span className="flex-1">{lesson.title}</span></button>)}
        </div>
        <div className="mt-5 space-y-4"><LearningResourcesPanel scope="STYLE" scopeId={styleId} title="Recursos del estilo" /><LearningAssessmentPanel scope="STYLE" scopeId={styleId} courseId={courseId} title="Evaluaciones del estilo" /></div>
      </aside>
      <section className="min-w-0 flex-1 space-y-6 p-6">
        {style.description && <p className="text-zinc-400">{style.description}</p>}
        {activeLesson ? <>
          <div className="overflow-hidden rounded-3xl border border-zinc-700 bg-black"><div className="aspect-video flex items-center justify-center">{videoUrl ? <video key={videoUrl} src={videoUrl} controls className="h-full w-full" /> : <span className="text-sm text-zinc-500">Esta lección no tiene video.</span>}</div></div>
          <div className="space-y-3"><h2 className="text-2xl font-semibold">{activeLesson.title}</h2>{activeLesson.description && <p className="text-zinc-300">{activeLesson.description}</p>}{activeLesson.transcript && <details className="rounded-xl border border-zinc-700 bg-white/5 p-4"><summary className="cursor-pointer text-sm font-medium">Transcripción</summary><p className="mt-3 whitespace-pre-wrap text-sm text-zinc-400">{activeLesson.transcript}</p></details>}<LearningResourcesPanel scope="LESSON" scopeId={activeLesson.id} title="Recursos de la lección" /><LearningAssessmentPanel scope="LESSON" scopeId={activeLesson.id} courseId={courseId} title="Evaluaciones de la lección" />{!completed.has(activeLesson.id) && <button type="button" onClick={() => void markLessonCompleted(activeLesson.id)} className="rounded-xl bg-ap-copper px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">Marcar lección como completada</button>}{message && <p className="text-sm text-ap-copper">{message}</p>}</div>
        </> : <p className="rounded-2xl border border-dashed border-zinc-700 p-8 text-zinc-400">Este estilo aún no tiene lecciones.</p>}
      </section>
    </div>
  </main>
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AI_AUTHORING_ENABLED } from '@/lib/feature-flags'
import { LearningContentManager } from './LearningContentManager'
import { MultipartVideoUploadField } from './MultipartVideoUploadField'

type ParentKind = 'module' | 'style'

type Lesson = {
  id: string
  title: string
  description: string | null
  videoUrl: string | null
  videoFileUrl: string | null
  transcript: string | null
}

type EditorPayload = {
  course: { title: string }
  modules: Array<{ id?: string; title: string }>
  styles: Array<{ id?: string; name: string }>
}

const inputClass = 'w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-ap-copper/60'
const cardClass = 'rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_16px_50px_rgba(0,0,0,0.12)] backdrop-blur-xl sm:p-8'

function errorMessage(payload: unknown, fallback: string) {
  return typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
    ? payload.error
    : fallback
}

export function LessonEditorForm({ parentKind }: { parentKind: ParentKind }) {
  const params = useParams<{ courseId: string; moduleId?: string; styleId?: string; lessonId?: string }>()
  const router = useRouter()
  const courseId = params.courseId
  const parentId = parentKind === 'module' ? params.moduleId : params.styleId
  const lessonId = params.lessonId
  const editing = Boolean(lessonId)
  const parentPath = parentKind === 'module' ? 'modules' : 'styles'
  const parentUrl = `/admin/courses/${courseId}/${parentPath}/${parentId}/edit`
  const lessonsUrl = `/api/admin/${parentKind === 'module' ? 'modules' : 'styles'}/${parentId}/lessons`

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [courseTitle, setCourseTitle] = useState('Curso')
  const [parentName, setParentName] = useState(parentKind === 'module' ? 'Módulo' : 'Estilo')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  const [generatingSynopsis, setGeneratingSynopsis] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const lessonLabel = editing ? (title.trim() || 'Lección') : (title.trim() || 'Nueva lección')
  const parentLabel = parentKind === 'module' ? 'Módulos' : 'Estilos'

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!courseId || !parentId) return
    setLoading(true)
    try {
      const [editorResponse, lessonsResponse] = await Promise.all([
        fetch(`/api/admin/courses/${courseId}/editor`, { signal }),
        editing ? fetch(lessonsUrl, { signal }) : Promise.resolve(null),
      ])
      const editorBody = await editorResponse.json().catch(() => ({}))
      if (!editorResponse.ok || !editorBody.success) throw new Error(errorMessage(editorBody, 'No se pudo cargar el editor.'))

      const payload = editorBody.data?.payload as EditorPayload
      setCourseTitle(payload?.course?.title || 'Curso')
      const name = parentKind === 'module'
        ? payload?.modules?.find((module) => module.id === parentId)?.title
        : payload?.styles?.find((style) => style.id === parentId)?.name
      if (!name) throw new Error(`${parentKind === 'module' ? 'El módulo' : 'El estilo'} no existe.`)
      setParentName(name)

      if (lessonsResponse) {
        const lessonsBody = await lessonsResponse.json().catch(() => ({}))
        if (!lessonsResponse.ok || !lessonsBody.success) throw new Error(errorMessage(lessonsBody, 'No se pudo cargar la lección.'))
        const lesson = (lessonsBody.data as Lesson[]).find((item) => item.id === lessonId)
        if (!lesson) throw new Error('La lección no existe.')
        setTitle(lesson.title)
        setDescription(lesson.description || '')
        setVideoFileUrl(lesson.videoFileUrl)
        setTranscript(lesson.transcript || '')
      }
    } catch (error) {
      if (!signal?.aborted) toast.error(error instanceof Error ? error.message : 'No se pudo cargar la lección.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [courseId, editing, lessonId, lessonsUrl, parentId, parentKind])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  // The transcript itself is still loaded and saved below, so hiding these
  // controls never drops a transcript a lesson already has.
  const canUseAiTools = useMemo(
    () => AI_AUTHORING_ENABLED && editing && Boolean(lessonId),
    [editing, lessonId]
  )

  async function save() {
    if (!title.trim()) {
      toast.error('Indicá el título de la lección.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(editing ? `${lessonsUrl}/${lessonId}` : lessonsUrl, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: editing ? description.trim() || null : description.trim() || undefined,
          videoFileUrl: editing ? videoFileUrl : videoFileUrl || undefined,
          ...(editing ? { transcript: transcript.trim() || null } : {}),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.success) throw new Error(errorMessage(body, 'No se pudo guardar la lección.'))
      toast.success(editing ? 'Lección actualizada.' : 'Lección creada.')
      router.push(parentUrl)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la lección.')
    } finally {
      setSaving(false)
    }
  }

  async function generateSynopsis() {
    if (!lessonId) return
    setGeneratingSynopsis(true)
    try {
      const response = await fetch('/api/ai/synopsis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.success || typeof body.data?.synopsis !== 'string') throw new Error(errorMessage(body, 'No se pudo generar la sinopsis.'))
      setDescription(body.data.synopsis)
      toast.success('Sinopsis generada. Guardala para aplicarla.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo generar la sinopsis.')
    } finally {
      setGeneratingSynopsis(false)
    }
  }

  async function transcribe() {
    if (!lessonId) return
    setTranscribing(true)
    try {
      const response = await fetch('/api/admin/transcribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.success || typeof body.data?.transcript !== 'string') throw new Error(errorMessage(body, 'No se pudo transcribir el video.'))
      setTranscript(body.data.transcript)
      toast.success('Transcripción lista. Guardala para aplicarla.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo transcribir el video.')
    } finally {
      setTranscribing(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-white/55">Cargando lección…</div>

  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <nav aria-label="Ruta del curso" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/55">
      <button type="button" onClick={() => router.push('/admin/courses')} className="transition hover:text-ap-copper">Cursos</button><span>/</span>
      <button type="button" onClick={() => router.push(`/admin/courses/${courseId}/edit`)} className="transition hover:text-ap-copper">{courseTitle}</button><span>/</span>
      <button type="button" onClick={() => router.push(`/admin/courses/${courseId}/edit`)} className="transition hover:text-ap-copper">{parentLabel}</button><span>/</span>
      <button type="button" onClick={() => router.push(parentUrl)} className="transition hover:text-ap-copper">{parentName}</button><span>/</span>
      <span className="text-white">{lessonLabel}</span>
    </nav>

    <section className={cardClass}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ap-copper">Editor de contenido</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">{editing ? 'Editar lección' : 'Nueva lección'}</h1>
      <p className="mt-2 text-sm text-white/55">{editing ? 'Actualiza el contenido y guarda cuando esté listo.' : 'La lección se creará únicamente cuando presiones Guardar.'}</p>

      <div className="mt-8 grid gap-5">
        <label className="space-y-2"><span className="text-sm font-medium text-white/75">Título</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} /></label>
        <label className="space-y-2"><span className="flex items-center justify-between gap-3 text-sm font-medium text-white/75">Descripción {canUseAiTools ? <button type="button" onClick={() => void generateSynopsis()} disabled={generatingSynopsis} className="text-xs font-medium text-ap-copper disabled:opacity-50">{generatingSynopsis ? 'Generando…' : 'Generar con IA'}</button> : null}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className={inputClass} /></label>
        <MultipartVideoUploadField courseId={courseId} label="Video de la lección (opcional)" value={videoFileUrl} onChange={setVideoFileUrl} />
        {canUseAiTools ? <label className="space-y-2"><span className="flex items-center justify-between gap-3 text-sm font-medium text-white/75">Transcripción <button type="button" onClick={() => void transcribe()} disabled={transcribing || !videoFileUrl} className="text-xs font-medium text-ap-copper disabled:opacity-50">{transcribing ? 'Transcribiendo…' : 'Transcribir video'}</button></span><textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} rows={5} placeholder="Transcripción del video…" className={inputClass} /></label> : null}
      </div>

      <div className="mt-8 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => router.push(parentUrl)} disabled={saving} className="rounded-xl border border-white/15 px-5 py-3 text-white/70 transition hover:bg-white/10 disabled:opacity-50">Cancelar</button><button type="button" onClick={() => void save()} disabled={saving} className="rounded-xl bg-ap-copper px-5 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button></div>
    </section>

    {editing && lessonId ? <section className={cardClass}><div className="mb-5"><h2 className="text-xl font-semibold text-white">Material y evaluaciones</h2><p className="mt-1 text-sm text-white/50">Gestioná los recursos y evaluaciones propios de esta lección.</p></div><div className="space-y-6"><LearningContentManager scope="LESSON" scopeId={lessonId} courseId={courseId} /></div></section> : null}
  </main>
}

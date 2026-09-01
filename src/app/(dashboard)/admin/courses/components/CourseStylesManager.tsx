'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import FileUploadProgress from '@/app/components/FileUploadProgress'
import { LearningContentManager } from './LearningContentManager'
import { toast } from 'sonner'

type Lesson = {
  id: string
  order: number
  title: string
  description: string | null
  videoUrl: string | null
  videoFileUrl: string | null
  transcript: string | null
}

type CourseStyle = {
  id: string
  order: number
  name: string
  description: string | null
  isActive: boolean
  lessons: Lesson[]
}

type StyleForm = { name: string; description: string; isActive: boolean }
type LessonForm = { title: string; description: string; videoUrl: string; transcript: string }

const emptyStyleForm: StyleForm = { name: '', description: '', isActive: true }
const emptyLessonForm: LessonForm = { title: '', description: '', videoUrl: '', transcript: '' }
const fieldClassName = 'w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-ap-copper/50'

export function CourseStylesManager({ courseId }: { courseId: string }) {
  const router = useRouter()
  const [styles, setStyles] = useState<CourseStyle[]>([])
  const [showStyleForm, setShowStyleForm] = useState(false)
  const [styleForm, setStyleForm] = useState<StyleForm>(emptyStyleForm)
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null)
  const [editingStyleForm, setEditingStyleForm] = useState<StyleForm>(emptyStyleForm)
  const [newLessonStyleId, setNewLessonStyleId] = useState<string | null>(null)
  const [lessonForm, setLessonForm] = useState<LessonForm>(emptyLessonForm)
  const [showLessonUpload, setShowLessonUpload] = useState(false)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
  const [editingLessonForm, setEditingLessonForm] = useState<LessonForm>(emptyLessonForm)
  const [showLessonEditUpload, setShowLessonEditUpload] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [draggedStyleId, setDraggedStyleId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/courses/${courseId}/styles`)
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error ?? 'No se pudieron cargar los estilos.')
    setStyles(body.data ?? [])
  }, [courseId])

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los estilos.'))
  }, [load])

  const send = async (url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) => {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error ?? 'No se pudo completar la operación.')
  }

  const withSave = async (work: () => Promise<void>, fallback: string) => {
    setSaving(true)
    setMessage(null)
    try {
      await work()
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : fallback)
    } finally {
      setSaving(false)
    }
  }

  const createStyle = () => {
    if (!styleForm.name.trim()) return toast.error('Indica el nombre del estilo.')
    void withSave(async () => {
      await send(`/api/admin/courses/${courseId}/styles`, 'POST', styleForm)
      setStyleForm(emptyStyleForm)
      setShowStyleForm(false)
    }, 'No se pudo crear el estilo.')
  }

  const saveStyle = (styleId: string) => {
    if (!editingStyleForm.name.trim()) return toast.error('Indica el nombre del estilo.')
    void withSave(async () => {
      await send(`/api/admin/courses/${courseId}/styles/${styleId}`, 'PUT', editingStyleForm)
      setEditingStyleId(null)
    }, 'No se pudo guardar el estilo.')
  }

  const deleteStyle = (style: CourseStyle) => {
    if (!confirm(`¿Eliminar el estilo “${style.name}” y sus lecciones?`)) return
    void withSave(() => send(`/api/admin/courses/${courseId}/styles/${style.id}`, 'DELETE'), 'No se pudo eliminar el estilo.')
  }

  const createLesson = (styleId: string) => {
    if (!lessonForm.title.trim()) return toast.error('Indica el título de la lección.')
    void withSave(async () => {
      await send(`/api/admin/styles/${styleId}/lessons`, 'POST', lessonForm)
      setLessonForm(emptyLessonForm)
      setNewLessonStyleId(null)
      setShowLessonUpload(false)
    }, 'No se pudo crear la lección.')
  }

  const saveLesson = (styleId: string, lessonId: string) => {
    if (!editingLessonForm.title.trim()) return toast.error('Indica el título de la lección.')
    void withSave(async () => {
      await send(`/api/admin/styles/${styleId}/lessons/${lessonId}`, 'PUT', editingLessonForm)
      setEditingLessonId(null)
      setShowLessonEditUpload(false)
    }, 'No se pudo guardar la lección.')
  }

  const deleteLesson = (styleId: string, lessonId: string) => {
    if (!confirm('¿Eliminar esta lección?')) return
    void withSave(() => send(`/api/admin/styles/${styleId}/lessons/${lessonId}`, 'DELETE'), 'No se pudo eliminar la lección.')
  }

  const startStyleEdit = (style: CourseStyle) => {
    router.push(`/admin/courses/${courseId}/styles/${style.id}/edit`)
  }

  const reorderStyles = (targetId: string) => {
    if (!draggedStyleId || draggedStyleId === targetId) return
    const ordered = [...styles].sort((a, b) => a.order - b.order)
    const from = ordered.findIndex((style) => style.id === draggedStyleId)
    const to = ordered.findIndex((style) => style.id === targetId)
    if (from < 0 || to < 0) return
    const [moved] = ordered.splice(from, 1)
    ordered.splice(to, 0, moved)
    setStyles(ordered.map((style, index) => ({ ...style, order: index })))
    void Promise.all(ordered.map((style, index) => send(`/api/admin/courses/${courseId}/styles/${style.id}`, 'PUT', { order: index + 1000 })))
      .then(() => Promise.all(ordered.map((style, index) => send(`/api/admin/courses/${courseId}/styles/${style.id}`, 'PUT', { order: index }))))
      .catch(() => toast.error('No se pudo guardar el orden de los estilos.'))
      .finally(() => setDraggedStyleId(null))
  }

  const startLessonEdit = (lesson: Lesson) => {
    setEditingLessonId(lesson.id)
    setEditingLessonForm({
      title: lesson.title,
      description: lesson.description ?? '',
      videoUrl: lesson.videoFileUrl ?? lesson.videoUrl ?? '',
      transcript: lesson.transcript ?? '',
    })
    setShowLessonEditUpload(false)
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Estilos</h2>
          <p className="mt-1 text-sm text-white/45">Categorías independientes del curso con sus propias lecciones.</p>
        </div>
        <button type="button" onClick={() => router.push(`/admin/courses/${courseId}/styles/new`)} className="rounded-xl bg-ap-copper px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
          + Nuevo estilo
        </button>
      </div>


      {false && showStyleForm && (
        <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <input value={styleForm.name} onChange={(event) => setStyleForm((form) => ({ ...form, name: event.target.value }))} placeholder="Nombre del estilo" className={fieldClassName} autoFocus />
          <textarea value={styleForm.description} onChange={(event) => setStyleForm((form) => ({ ...form, description: event.target.value }))} placeholder="Descripción (opcional)" rows={2} className={`${fieldClassName} resize-y`} />
          <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={styleForm.isActive} onChange={(event) => setStyleForm((form) => ({ ...form, isActive: event.target.checked }))} /> Visible para estudiantes</label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowStyleForm(false)} className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10">Descartar</button><button type="button" disabled={saving} onClick={createStyle} className="rounded-lg bg-ap-copper px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Crear estilo</button></div>
        </div>
      )}

      <div className="mt-5 space-y-4">
        {styles.length === 0 && <p className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-sm text-white/45">Todavía no hay estilos en este curso.</p>}
        {styles.map((style) => (
          <article key={style.id} draggable onClick={() => startStyleEdit(style)} onDragStart={() => setDraggedStyleId(style.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderStyles(style.id)} className="cursor-pointer rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-ap-copper/40">
            {editingStyleId === style.id ? (
              <div className="space-y-3">
                <input value={editingStyleForm.name} onChange={(event) => setEditingStyleForm((form) => ({ ...form, name: event.target.value }))} className={fieldClassName} autoFocus />
                <textarea value={editingStyleForm.description} onChange={(event) => setEditingStyleForm((form) => ({ ...form, description: event.target.value }))} rows={2} className={`${fieldClassName} resize-y`} />
                <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={editingStyleForm.isActive} onChange={(event) => setEditingStyleForm((form) => ({ ...form, isActive: event.target.checked }))} /> Visible para estudiantes</label>
                <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingStyleId(null)} className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10">Cancelar</button><button type="button" disabled={saving} onClick={() => saveStyle(style.id)} className="rounded-lg bg-ap-copper px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Guardar</button></div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="pt-0.5 text-xl leading-none text-white/30">⋮⋮</span><div><div className="flex items-center gap-2"><span className="rounded-lg bg-ap-copper/10 px-2 py-1 text-sm font-bold text-ap-copper">Estilo {style.order}</span><h3 className="font-semibold text-white">{style.name}</h3>{!style.isActive && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">Oculto</span>}</div>{style.description && <p className="mt-1 text-sm text-white/45">{style.description}</p>}</div></div><div className="flex gap-3 text-sm"><button type="button" onClick={(event) => { event.stopPropagation(); startStyleEdit(style) }} className="text-ap-copper hover:text-orange-300">Editar</button><button type="button" onClick={(event) => { event.stopPropagation(); deleteStyle(style) }} className="text-red-400 hover:text-red-300">Eliminar</button></div></div>
            )}

            {false && <LearningContentManager scope="STYLE" scopeId={style.id} courseId={courseId} />}

            {false && <div>
              <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="text-sm font-medium text-white/80">Lecciones del estilo</h4><button type="button" onClick={() => { setNewLessonStyleId((id) => id === style.id ? null : style.id); setLessonForm(emptyLessonForm); setShowLessonUpload(false) }} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/15">{newLessonStyleId === style.id ? 'Cancelar' : '+ Nueva lección'}</button></div>

              {newLessonStyleId === style.id && <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-3"><input value={lessonForm.title} onChange={(event) => setLessonForm((form) => ({ ...form, title: event.target.value }))} placeholder="Título de la lección" className={fieldClassName} autoFocus /><textarea value={lessonForm.description} onChange={(event) => setLessonForm((form) => ({ ...form, description: event.target.value }))} placeholder="Descripción (opcional)" rows={2} className={`${fieldClassName} resize-y`} />{lessonForm.videoUrl ? <div className="flex justify-between rounded-lg border border-green-500/30 bg-green-500/10 p-2 text-xs text-green-300"><span>Video listo</span><button type="button" onClick={() => setLessonForm((form) => ({ ...form, videoUrl: '' }))} className="text-red-300">Quitar</button></div> : (showLessonUpload ? <FileUploadProgress uploadType="video" lessonId="temp" onUploadComplete={(file) => { setLessonForm((form) => ({ ...form, videoUrl: file.fileUrl })); setShowLessonUpload(false) }} /> : <button type="button" onClick={() => setShowLessonUpload(true)} className="rounded-lg border border-ap-copper/50 px-3 py-2 text-xs text-ap-copper hover:bg-ap-copper/10">Subir video (opcional)</button>)}<div className="flex justify-end gap-2"><button type="button" onClick={() => setNewLessonStyleId(null)} className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10">Descartar</button><button type="button" disabled={saving} onClick={() => createLesson(style.id)} className="rounded-lg bg-ap-copper px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Crear lección</button></div></div>}

              <div className="mt-3 space-y-2">
                {style.lessons.length === 0 && <p className="text-sm text-white/40">Sin lecciones todavía.</p>}
                {style.lessons.map((lesson, index) => (
                  <div key={lesson.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    {editingLessonId === lesson.id ? (
                      <div className="space-y-3">
                        <input value={editingLessonForm.title} onChange={(event) => setEditingLessonForm((form) => ({ ...form, title: event.target.value }))} className={fieldClassName} autoFocus />
                        <textarea value={editingLessonForm.description} onChange={(event) => setEditingLessonForm((form) => ({ ...form, description: event.target.value }))} rows={2} className={`${fieldClassName} resize-y`} />
                        <textarea value={editingLessonForm.transcript} onChange={(event) => setEditingLessonForm((form) => ({ ...form, transcript: event.target.value }))} placeholder="Transcripción (opcional)" rows={3} className={`${fieldClassName} resize-y`} />
                        {editingLessonForm.videoUrl ? <div className="flex justify-between rounded-lg border border-green-500/30 bg-green-500/10 p-2 text-xs text-green-300"><span>Video listo</span><button type="button" onClick={() => setEditingLessonForm((form) => ({ ...form, videoUrl: '' }))} className="text-red-300">Quitar</button></div> : (showLessonEditUpload ? <FileUploadProgress uploadType="video" lessonId={lesson.id} onUploadComplete={(file) => { setEditingLessonForm((form) => ({ ...form, videoUrl: file.fileUrl })); setShowLessonEditUpload(false) }} /> : <button type="button" onClick={() => setShowLessonEditUpload(true)} className="rounded-lg border border-ap-copper/50 px-3 py-2 text-xs text-ap-copper hover:bg-ap-copper/10">Subir video</button>)}
                        <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingLessonId(null)} className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10">Cancelar</button><button type="button" disabled={saving} onClick={() => saveLesson(style.id, lesson.id)} className="rounded-lg bg-ap-copper px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Guardar</button></div>
                        <LearningContentManager scope="LESSON" scopeId={lesson.id} courseId={courseId} />
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-white/80">{index + 1}. {lesson.title}</p>{lesson.description && <p className="mt-1 text-xs text-white/45">{lesson.description}</p>}{(lesson.videoFileUrl || lesson.videoUrl) && <p className="mt-1 text-xs text-green-400">✓ video</p>}</div><div className="flex gap-3 text-xs"><button type="button" onClick={() => startLessonEdit(lesson)} className="text-ap-copper hover:text-orange-300">Editar</button><button type="button" onClick={() => deleteLesson(style.id, lesson.id)} className="text-red-400 hover:text-red-300">Eliminar</button></div></div>
                    )}
                  </div>
                ))}
              </div>
            </div>}
          </article>
        ))}
      </div>
    </section>
  )
}

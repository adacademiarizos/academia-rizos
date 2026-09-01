'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MultipartVideoUploadField } from './MultipartVideoUploadField'
import { PresentationImageUploadField } from './PresentationImageUploadField'

export function NewCourseContentForm({ kind }: { kind: 'module' | 'style' }) {
  const params = useParams<{ courseId: string }>()
  const router = useRouter()
  const courseId = params.courseId
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null)
  const [bannerImageUrl, setBannerImageUrl] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [courseTitle, setCourseTitle] = useState('Curso')
  const courseUrl = `/admin/courses/${courseId}/edit`
  const label = kind === 'module' ? 'módulo' : 'estilo'

  useEffect(() => {
    void fetch('/api/admin/courses?limit=100')
      .then((response) => response.json())
      .then((result) => {
        const courses = Array.isArray(result?.data) ? result.data : []
        const title = courses.find((course: { id?: string }) => course.id === courseId)?.title
        if (typeof title === 'string' && title.trim()) setCourseTitle(title)
      })
      .catch(() => undefined)
  }, [courseId])

  async function save() {
    if (!name.trim()) return toast.error(`Indicá el ${label}.`)
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/courses/${courseId}/${kind === 'module' ? 'modules' : 'styles'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'module' ? { title: name.trim(), description: description || undefined, videoFileUrl: videoFileUrl || undefined, bannerImageUrl: bannerImageUrl || undefined } : { name: name.trim(), description: description || null, isActive, videoFileUrl: videoFileUrl || undefined, bannerImageUrl: bannerImageUrl || undefined }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.success) throw new Error(result.error || `No se pudo crear el ${label}.`)
      toast.success(`${kind === 'module' ? 'Módulo' : 'Estilo'} creado.`)
      const createdId = result?.data?.id
      router.push(createdId
        ? `${courseUrl.replace(/\/edit$/, '')}/${kind === 'module' ? 'modules' : 'styles'}/${createdId}/edit`
        : courseUrl)
    } catch (error) { toast.error(error instanceof Error ? error.message : `No se pudo crear el ${label}.`) } finally { setSaving(false) }
  }

  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <nav aria-label="Ruta del curso" className="flex flex-wrap items-center gap-2 text-sm text-white/55"><button type="button" onClick={() => router.push('/admin/courses')} className="hover:text-ap-copper">Cursos</button><span>/</span><button type="button" onClick={() => router.push(courseUrl)} className="hover:text-ap-copper">{courseTitle}</button><span>/</span><button type="button" onClick={() => router.push(courseUrl)} className="hover:text-ap-copper">{kind === 'module' ? 'Módulos' : 'Estilos'}</button><span>/</span><span className="text-white">{name.trim() || `Nuevo ${label}`}</span></nav>
    <section className="rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_16px_50px_rgba(0,0,0,0.12)] backdrop-blur-xl sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ap-copper">Editor de contenido</p><h1 className="mt-2 text-3xl font-semibold text-white">Nuevo {label}</h1><p className="mt-2 text-sm text-white/55">Se creará únicamente cuando presiones Guardar.</p><div className="mt-8 grid gap-5"><label className="space-y-2"><span className="text-sm font-medium text-white/75">{kind === 'module' ? 'Título' : 'Nombre'}</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none focus:border-ap-copper/60" /></label><label className="space-y-2"><span className="text-sm font-medium text-white/75">Descripción</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none focus:border-ap-copper/60" /></label><MultipartVideoUploadField courseId={courseId} label="Video de presentación (opcional)" value={videoFileUrl} onChange={setVideoFileUrl} /><PresentationImageUploadField label="Imagen o banner de presentación (opcional)" value={bannerImageUrl} onChange={setBannerImageUrl} />{kind === 'style' ? <label className="flex items-center gap-2 text-sm text-white/75"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Visible para estudiantes</label> : null}</div><div className="mt-8 flex justify-end gap-3"><button type="button" onClick={() => router.push(courseUrl)} disabled={saving} className="rounded-xl border border-white/15 px-5 py-3 text-white/70 hover:bg-white/10">Cancelar</button><button type="button" onClick={() => void save()} disabled={saving} className="rounded-xl bg-ap-copper px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button></div></section>
  </main>
}

'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { CourseContentStructure, CourseDraftPayload, DraftLesson, DraftModule, DraftStyle } from '@/lib/course-draft'
import { isSameCourseEditorNavigation, shouldBlockEditorNavigation } from '@/lib/editor-navigation'
import { MultipartVideoUploadField } from './MultipartVideoUploadField'
import { PresentationImageUploadField } from './PresentationImageUploadField'
import { LearningContentManager } from './LearningContentManager'

type EditorLevel = 'course' | 'module' | 'style'
type EditorSource = 'DRAFT' | 'PUBLISHED'
type PendingNavigation = string | 'BACK' | null

const inputClass = 'w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-white outline-none transition placeholder:text-white/35 focus:border-ap-copper/60'
const cardClass = 'rounded-[24px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.12)] backdrop-blur-xl sm:p-6'

function draftRouteId(entity: { id?: string; clientId: string }) {
  return entity.id ?? entity.clientId
}

/**
 * Reads an editor API response. A missing route or a crashed request answers with
 * an HTML error page, and parsing that as JSON throws "Unexpected token '<'",
 * which tells the author nothing about what actually failed.
 */
async function readEditorResponse(response: Response, fallbackError: string) {
  const body = await response.text()
  let result: { success?: boolean; error?: string } | null = null
  try {
    result = body ? JSON.parse(body) : null
  } catch {
    throw new Error(`${fallbackError} (el servidor respondió ${response.status}).`)
  }
  if (!response.ok || !result?.success) throw new Error(result?.error || fallbackError)
  return result
}

function decodeRouteParam(value: string | undefined) {
  if (!value) return undefined
  try { return decodeURIComponent(value) } catch { return value }
}

function entityMatches(entity: { id?: string; clientId: string }, routeId?: string) {
  return Boolean(routeId) && (entity.id === routeId || entity.clientId === routeId)
}

function structureLabel(structure: CourseContentStructure) {
  if (structure === 'MODULES') return 'Módulos'
  if (structure === 'STYLES') return 'Estilos'
  return 'Módulos y estilos'
}

function sectionTitle(level: EditorLevel) {
  if (level === 'course') return 'Información del curso'
  if (level === 'module') return 'Editar módulo'
  return 'Editar estilo'
}

function allowsModules(structure: CourseContentStructure) {
  return structure === 'MODULES' || structure === 'BOTH'
}

function allowsStyles(structure: CourseContentStructure) {
  return structure === 'STYLES' || structure === 'BOTH'
}

export default function CourseEditor({ level }: { level: EditorLevel }) {
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  const moduleId = decodeRouteParam(params.moduleId as string | undefined)
  const styleId = decodeRouteParam(params.styleId as string | undefined)
  const courseUrl = `/admin/courses/${courseId}/edit`

  const [payload, setPayload] = useState<CourseDraftPayload | null>(null)
  const [initialPayload, setInitialPayload] = useState('')
  const [source, setSource] = useState<EditorSource>('PUBLISHED')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<'draft' | 'publish' | 'discard' | 'migrate' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [needsStructureMigration, setNeedsStructureMigration] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation>(null)
  const [showExitDialog, setShowExitDialog] = useState(false)
  const dirtyRef = useRef(false)
  const payloadRef = useRef<CourseDraftPayload | null>(null)
  const ignorePopStateRef = useRef(false)

  const serializedPayload = payload ? JSON.stringify(payload) : ''
  const isDirty = Boolean(payload && initialPayload && serializedPayload !== initialPayload)
  dirtyRef.current = isDirty
  payloadRef.current = payload

  const currentModule = useMemo(
    () => payload?.modules.find((module) => entityMatches(module, moduleId)),
    [payload, moduleId]
  )
  const currentStyle = useMemo(
    () => payload?.styles.find((style) => entityMatches(style, styleId)),
    [payload, styleId]
  )

  const moduleUrl = (module: DraftModule) => `/admin/courses/${courseId}/modules/${draftRouteId(module)}/edit`
  const styleUrl = (style: DraftStyle) => `/admin/courses/${courseId}/styles/${draftRouteId(style)}/edit`
  // Siblings of the editor page, not children of it: courseUrl already ends in
  // /edit, so appending to it produces routes that do not exist.
  const newModuleUrl = `/admin/courses/${courseId}/modules/new`
  const newStyleUrl = `/admin/courses/${courseId}/styles/new`

  const loadEditor = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/admin/courses/${courseId}/editor`, { signal })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo cargar el curso')
      if (signal?.aborted) return
      const nextPayload = result.data.payload as CourseDraftPayload
      setPayload(nextPayload)
      setInitialPayload(JSON.stringify(nextPayload))
      setSource(result.data.source as EditorSource)
      setNeedsStructureMigration(Boolean(result.data.needsStructureMigration))
    } catch (loadError) {
      if (signal?.aborted) return
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el curso')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    const controller = new AbortController()
    void loadEditor(controller.signal)
    return () => controller.abort()
  }, [loadEditor])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || !(event.target instanceof Element)) return
      const anchor = event.target.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank') return

      const destination = anchor.getAttribute('href')
      const hasModifier = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      if (!destination) return

      const nextUrl = new URL(destination, window.location.href)
      const isInternalCourseMove = dirtyRef.current && !hasModifier && isSameCourseEditorNavigation(window.location.href, destination)
      if (isInternalCourseMove) {
        event.preventDefault()
        void saveDraftBeforeInternalNavigation(nextUrl.pathname + nextUrl.search + nextUrl.hash)
        return
      }

      if (!shouldBlockEditorNavigation({
        isDirty: dirtyRef.current,
        currentUrl: window.location.href,
        destination,
        hasModifier,
      })) return

      event.preventDefault()
      setPendingNavigation(nextUrl.pathname + nextUrl.search + nextUrl.hash)
      setShowExitDialog(true)
    }

    document.addEventListener('click', handleDocumentClick, true)
    return () => document.removeEventListener('click', handleDocumentClick, true)
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      if (ignorePopStateRef.current) {
        ignorePopStateRef.current = false
        return
      }
      if (!dirtyRef.current) return

      ignorePopStateRef.current = true
      window.history.go(1)
      setPendingNavigation('BACK')
      setShowExitDialog(true)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function replacePayload(updater: (current: CourseDraftPayload) => CourseDraftPayload) {
    setPayload((current) => current ? updater(current) : current)
  }

  function updateModule(targetId: string, updater: (module: DraftModule) => DraftModule) {
    replacePayload((current) => ({
      ...current,
      modules: current.modules.map((module) => entityMatches(module, targetId) ? updater(module) : module),
    }))
  }

  function updateStyle(targetId: string, updater: (style: DraftStyle) => DraftStyle) {
    replacePayload((current) => ({
      ...current,
      styles: current.styles.map((style) => entityMatches(style, targetId) ? updater(style) : style),
    }))
  }

  async function requestDraftSave(snapshot: CourseDraftPayload) {
    const response = await fetch(`/api/admin/courses/${courseId}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: snapshot }),
    })
    await readEditorResponse(response, 'No se pudo guardar el borrador')
  }

  async function saveDraftBeforeInternalNavigation(destination: string) {
    const snapshot = payloadRef.current
    if (!snapshot) {
      router.push(destination)
      return
    }

    try {
      setSaving('draft')
      setError(null)
      await requestDraftSave(snapshot)
      setInitialPayload(JSON.stringify(snapshot))
      setSource('DRAFT')
      router.push(destination)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el borrador antes de cambiar de sección')
    } finally {
      setSaving(null)
    }
  }

  function attemptNavigation(destination: string) {
    if (!isDirty) {
      router.push(destination)
      return
    }
    if (isSameCourseEditorNavigation(window.location.href, destination)) {
      void saveDraftBeforeInternalNavigation(destination)
      return
    }
    setPendingNavigation(destination)
    setShowExitDialog(true)
  }

  async function saveDraft(continueAfterSave = false) {
    if (!payload) return
    try {
      setSaving('draft')
      await requestDraftSave(payload)
      setInitialPayload(JSON.stringify(payload))
      setSource('DRAFT')
      setNotice('Borrador guardado. Solo vos podés verlo hasta que publiques.')
      if (continueAfterSave) continueNavigation()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el borrador')
    } finally {
      setSaving(null)
    }
  }

  async function publish(continueAfterPublish = false) {
    if (!payload) return
    try {
      setSaving('publish')
      const response = await fetch(`/api/admin/courses/${courseId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      })
      await readEditorResponse(response, 'No se pudo publicar el curso')
      setInitialPayload(JSON.stringify(payload))
      setSource('PUBLISHED')
      setNotice('Cambios publicados para las estudiantes.')
      if (continueAfterPublish) continueNavigation()
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'No se pudo publicar el curso')
    } finally {
      setSaving(null)
    }
  }

  async function discard(continueAfterDiscard = false) {
    try {
      setSaving('discard')
      const response = await fetch(`/api/admin/courses/${courseId}/draft`, { method: 'DELETE' })
      await readEditorResponse(response, 'No se pudo descartar el borrador')
      setInitialPayload(serializedPayload)
      if (continueAfterDiscard) continueNavigation()
      else router.replace(courseUrl)
    } catch (discardError) {
      setError(discardError instanceof Error ? discardError.message : 'No se pudo descartar el borrador')
    } finally {
      setSaving(null)
    }
  }

  function continueNavigation() {
    const destination = pendingNavigation
    setShowExitDialog(false)
    setPendingNavigation(null)
    if (!destination) return
    if (destination === 'BACK') {
      ignorePopStateRef.current = true
      router.back()
    }
    else router.push(destination)
  }

  async function migrateLegacyCourse(contentStructure: CourseContentStructure) {
    try {
      setSaving('migrate')
      const response = await fetch(`/api/admin/courses/${courseId}/content-structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentStructure }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo migrar el curso')
      await loadEditor()
      setNotice('La estructura del curso fue actualizada.')
    } catch (migrationError) {
      setError(migrationError instanceof Error ? migrationError.message : 'No se pudo migrar el curso')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="p-6 text-sm text-white/55">Cargando editor…</div>
  if (!payload) return <div className="p-6 text-red-300">{error || 'No se pudo cargar el curso.'}</div>
  if (needsStructureMigration) return <LegacyStructurePanel busy={saving === 'migrate'} courseTitle={payload.course.title} error={error} onChoose={migrateLegacyCourse} />
  if ((level === 'module' && !currentModule) || (level === 'style' && !currentStyle)) {
    return <div className="mx-auto max-w-4xl space-y-4 p-6 text-white"><p className="text-red-300">La parte del curso que buscás no existe en esta versión.</p><button type="button" onClick={() => router.push(courseUrl)} className="text-ap-copper underline">Volver al curso</button></div>
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumbs courseTitle={payload.course.title} level={level} module={currentModule} style={currentStyle} courseUrl={courseUrl} onNavigate={attemptNavigation} />

      <header className={`${cardClass} flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ap-copper">Editor de contenido</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{sectionTitle(level)}</h1>
          <p className="mt-2 text-sm text-white/55">Estructura del curso: <span className="font-medium text-white/85">{structureLabel(payload.course.contentStructure)}</span></p>
        </div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void saveDraft()} disabled={saving !== null || !isDirty} className="rounded-xl border border-ap-copper/50 px-4 py-2 text-sm font-medium text-ap-copper disabled:cursor-not-allowed disabled:opacity-40">Guardar borrador</button><button type="button" onClick={() => void publish()} disabled={saving !== null} className="rounded-xl bg-ap-copper px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving === 'publish' ? 'Publicando…' : source === 'DRAFT' ? 'Publicar cambios' : 'Guardar y publicar'}</button></div>
      </header>

      {error ? <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p> : null}
      {notice ? <p className="rounded-xl border border-ap-copper/30 bg-ap-copper/10 px-4 py-3 text-sm text-ap-copper">{notice}</p> : null}

      {level === 'course' ? <CoursePanelWithUpload payload={payload} onChange={(course) => replacePayload((current) => ({ ...current, course: { ...current.course, ...course } }))} onAddModule={() => attemptNavigation(newModuleUrl)} onAddStyle={() => attemptNavigation(newStyleUrl)} onNavigate={attemptNavigation} moduleUrl={moduleUrl} styleUrl={styleUrl} /> : null}
      {level === 'module' && currentModule ? <ModulePanel module={currentModule} courseId={courseId} onChange={(change) => updateModule(draftRouteId(currentModule), (module) => ({ ...module, ...change }))} /> : null}
      {level === 'style' && currentStyle ? <StylePanel style={currentStyle} courseId={courseId} onChange={(change) => updateStyle(draftRouteId(currentStyle), (style) => ({ ...style, ...change }))} /> : null}

      {showExitDialog ? <ExitDialog busy={saving !== null} onCancel={() => { setShowExitDialog(false); setPendingNavigation(null) }} onSaveDraft={() => void saveDraft(true)} onPublish={() => void publish(true)} onDiscard={() => void discard(true)} /> : null}
    </div>
  )
}

function Breadcrumbs({ courseTitle, level, module, style, courseUrl, onNavigate }: { courseTitle: string; level: EditorLevel; module?: DraftModule; style?: DraftStyle; courseUrl: string; onNavigate: (url: string) => void }) {
  const items: Array<{ label: string; url?: string }> = [{ label: 'Cursos', url: '/admin/courses' }, { label: courseTitle, url: courseUrl }]
  if (level === 'module' && module) items.push({ label: 'Módulos', url: courseUrl }, { label: module.title })
  if (level === 'style' && style) items.push({ label: 'Estilos', url: courseUrl }, { label: style.name })
  return <nav aria-label="Ruta del curso" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/55">{items.map((item, index) => <span key={`${item.label}-${index}`} className="flex items-center gap-2">{item.url ? <button type="button" onClick={() => onNavigate(item.url!)} className="transition hover:text-ap-copper">{item.label}</button> : <span className="text-white">{item.label}</span>}{index < items.length - 1 ? <span aria-hidden="true">/</span> : null}</span>)}</nav>
}

function LearningOutcomesEditor({ outcomes, onChange }: { outcomes: string[]; onChange: (outcomes: string[]) => void }) {
  function replaceAt(index: number, value: string) {
    onChange(outcomes.map((outcome, position) => (position === index ? value : outcome)))
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-white/45">
        Se muestran en la página pública del curso. Si lo dejás vacío, la sección no aparece.
      </p>
      {outcomes.map((outcome, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-ap-copper" aria-hidden="true">✓</span>
          <input
            value={outcome}
            onChange={(event) => replaceAt(index, event.target.value)}
            placeholder="Ej.: Diagnosticar el patrón de rizo y la porosidad"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => onChange(outcomes.filter((_, position) => position !== index))}
            aria-label={'Quitar el punto ' + String(index + 1)}
            className="rounded-lg px-2 py-1 text-sm text-red-300 transition hover:bg-red-400/10"
          >
            Quitar
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...outcomes, ''])}
        className="rounded-xl border border-ap-copper/60 px-3 py-2 text-sm font-medium text-ap-copper transition hover:bg-ap-copper/10"
      >
        + Agregar punto
      </button>
    </div>
  )
}

function CoursePanelWithUpload({ payload, onChange, onAddModule, onAddStyle, onNavigate, moduleUrl, styleUrl }: { payload: CourseDraftPayload; onChange: (change: Partial<CourseDraftPayload['course']>) => void; onAddModule: () => void; onAddStyle: () => void; onNavigate: (url: string) => void; moduleUrl: (module: DraftModule) => string; styleUrl: (style: DraftStyle) => string }) {
  const { course } = payload

  return (
    <div className="space-y-7">
      <section className={cardClass}>
        <div className="grid gap-5">
          <Field label="Título">
            <input value={course.title} onChange={(event) => onChange({ title: event.target.value })} className={inputClass} />
          </Field>
          <Field label="Descripción">
            <textarea value={course.description ?? ''} onChange={(event) => onChange({ description: event.target.value || null })} className={inputClass} rows={5} />
          </Field>
          <Field label="Lo que aprenderás">
            <LearningOutcomesEditor
              outcomes={course.learningOutcomes}
              onChange={(learningOutcomes) => onChange({ learningOutcomes })}
            />
          </Field>
          <Field label="Slogan del certificado">
            <input
              value={course.certificateSlogan ?? ''}
              onChange={(event) => onChange({ certificateSlogan: event.target.value || null })}
              placeholder="Ej.: Especialización en definición y cuidado de rizos"
              maxLength={100}
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-white/45">
              Aparece en el certificado. Obligatorio para publicar el curso como activo: sin él no se
              puede emitir el certificado cuando alguien aprueba el examen final.
            </p>
          </Field>
          <PresentationImageUploadField
            label="Miniatura del curso"
            itemName="miniatura"
            value={course.thumbnailUrl}
            onChange={(thumbnailUrl) => onChange({ thumbnailUrl })}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Precio (USD)">
              <input type="number" min="0" step="0.01" value={(course.priceCents / 100).toFixed(2)} onChange={(event) => onChange({ priceCents: Math.max(0, Math.round(Number(event.target.value || 0) * 100)) })} className={inputClass} />
            </Field>
            <Field label="Días de acceso (vacío = de por vida)">
              <input type="number" min="1" value={course.rentalDays ?? ''} onChange={(event) => onChange({ rentalDays: event.target.value ? Number(event.target.value) : null })} className={inputClass} />
            </Field>
          </div>
          <label className="flex w-fit items-center gap-2 text-sm text-white/75">
            <input type="checkbox" checked={course.isActive} onChange={(event) => onChange({ isActive: event.target.checked })} /> Curso activo al publicar
          </label>
        </div>
      </section>
      {allowsModules(course.contentStructure) ? (
        <ContentCollection title="Módulos" description="Unidades de aprendizaje con video propio y lecciones." emptyText="Todavía no hay módulos." addLabel="+ Nuevo módulo" onAdd={onAddModule}>
          {payload.modules.map((module) => <ContentRow key={module.clientId} title={String(module.order + 1) + '. ' + module.title} subtitle={String(module.lessons.length) + ' lecciones · ' + (module.videoFileUrl ? 'Video agregado' : 'Sin video')} onEdit={() => onNavigate(moduleUrl(module))} />)}
        </ContentCollection>
      ) : null}
      {allowsStyles(course.contentStructure) ? (
        <ContentCollection title="Estilos" description="Cada estilo reúne directamente sus lecciones." emptyText="Todavía no hay estilos." addLabel="+ Nuevo estilo" onAdd={onAddStyle}>
          {payload.styles.map((style) => <ContentRow key={style.clientId} title={style.name} subtitle={String(style.lessons.length) + ' lecciones'} onEdit={() => onNavigate(styleUrl(style))} />)}
        </ContentCollection>
      ) : null}
    </div>
  )
}

function ContentCollection({ title, description, emptyText, addLabel, onAdd, children }: { title: string; description: string; emptyText: string; addLabel: string; onAdd: () => void; children: ReactNode }) {
  const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return <section className={cardClass}><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-white">{title}</h2><p className="mt-1 text-sm text-white/50">{description}</p></div><button type="button" onClick={onAdd} className="rounded-xl bg-ap-copper px-4 py-2 text-sm font-semibold text-white hover:brightness-110">{addLabel}</button></div><div className="mt-5 space-y-3">{hasContent ? children : <p className="rounded-xl border border-dashed border-white/20 px-4 py-6 text-sm text-white/45">{emptyText}</p>}</div></section>
}

function ContentRow({ title, subtitle, onEdit }: { title: string; subtitle: string; onEdit: () => void }) {
  return <button type="button" onClick={onEdit} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition hover:border-ap-copper/40 hover:bg-white/[0.07]"><span><span className="font-semibold text-white">{title}</span><span className="mt-1 block text-sm text-white/45">{subtitle}</span></span><span className="shrink-0 text-sm font-medium text-ap-copper">Editar →</span></button>
}

function ModulePanel({ module, courseId, onChange }: { module: DraftModule; courseId: string; onChange: (change: Partial<DraftModule>) => void }) {
  const moduleBaseUrl = `/admin/courses/${courseId}/modules/${module.id}`
  return <div className="space-y-7"><section className={cardClass}><div className="grid gap-5"><Field label="Título"><input value={module.title} onChange={(event) => onChange({ title: event.target.value })} className={inputClass} /></Field><Field label="Descripción"><textarea value={module.description ?? ''} onChange={(event) => onChange({ description: event.target.value || null })} className={inputClass} rows={4} /></Field><VideoUploadField courseId={courseId} label="Video del módulo" value={module.videoFileUrl} onChange={(videoFileUrl) => onChange({ videoFileUrl })} /><PresentationImageUploadField label="Imagen o banner de presentación (opcional)" value={module.bannerImageUrl} onChange={(bannerImageUrl) => onChange({ bannerImageUrl })} /></div></section><LessonCollection lessons={module.lessons} parentKind="module" parentId={module.id} lessonBaseUrl={moduleBaseUrl} onChange={(lessons) => onChange({ lessons })} /><LearningContentManager scope="MODULE" scopeId={module.id ?? module.clientId} courseId={courseId} /></div>
}

function StylePanel({ style, courseId, onChange }: { style: DraftStyle; courseId: string; onChange: (change: Partial<DraftStyle>) => void }) {
  const styleBaseUrl = `/admin/courses/${courseId}/styles/${style.id}`
  return <div className="space-y-7"><section className={cardClass}><div className="grid gap-5"><Field label="Nombre del estilo"><input value={style.name} onChange={(event) => onChange({ name: event.target.value })} className={inputClass} /></Field><Field label="Descripción"><textarea value={style.description ?? ''} onChange={(event) => onChange({ description: event.target.value || null })} className={inputClass} rows={4} /></Field><VideoUploadField courseId={courseId} label="Video del estilo (opcional)" value={style.videoFileUrl} onChange={(videoFileUrl) => onChange({ videoFileUrl })} /><PresentationImageUploadField label="Imagen o banner de presentación (opcional)" value={style.bannerImageUrl} onChange={(bannerImageUrl) => onChange({ bannerImageUrl })} /><label className="flex w-fit items-center gap-2 text-sm text-white/75"><input type="checkbox" checked={style.isActive} onChange={(event) => onChange({ isActive: event.target.checked })} /> Estilo activo al publicar</label></div></section><LessonCollection lessons={style.lessons} parentKind="style" parentId={style.id} lessonBaseUrl={styleBaseUrl} onChange={(lessons) => onChange({ lessons })} /><LearningContentManager scope="STYLE" scopeId={style.id ?? style.clientId} courseId={courseId} /></div>
}

function LessonCollection({ lessons, parentKind, parentId, lessonBaseUrl, onChange }: { lessons: DraftLesson[]; parentKind: 'module' | 'style'; parentId?: string; lessonBaseUrl: string; onChange: (lessons: DraftLesson[]) => void }) {
  const router = useRouter()
  const [draggedLessonId, setDraggedLessonId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const directParentId = parentId && !parentId.startsWith('draft:') ? parentId : null
  const endpoint = directParentId ? `/api/admin/${parentKind === 'module' ? 'modules' : 'styles'}/${directParentId}/lessons` : null
  const orderedLessons = [...lessons].sort((left, right) => left.order - right.order)

  const lessonUrl = (lesson: DraftLesson) => `${lessonBaseUrl}/lessons/${lesson.id}/edit`

  async function updateOrder(lessonId: string, order: number) {
    if (!endpoint) throw new Error('Guardá primero el contenedor de la lección.')
    const response = await fetch(`${endpoint}/${lessonId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }) })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.success) throw new Error(typeof body.error === 'string' ? body.error : 'No se pudo guardar el orden de las lecciones.')
  }

  async function persistContiguousOrder(next: DraftLesson[]) {
    if (next.some((lesson) => !lesson.id || lesson.id.startsWith('draft:'))) {
      throw new Error('Las lecciones del borrador se ordenan al publicarlo.')
    }
    await Promise.all(next.map((lesson, index) => updateOrder(lesson.id!, 1_000_000 + index)))
    await Promise.all(next.map((lesson, index) => updateOrder(lesson.id!, index)))
    return next.map((lesson, index) => ({ ...lesson, order: index }))
  }

  async function reorder(targetId: string) {
    if (!draggedLessonId || draggedLessonId === targetId || reordering) return
    const from = orderedLessons.findIndex((lesson) => lesson.id === draggedLessonId)
    const to = orderedLessons.findIndex((lesson) => lesson.id === targetId)
    if (from < 0 || to < 0 || !endpoint) return
    const next = [...orderedLessons]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)

    setReordering(true)
    try {
      onChange(await persistContiguousOrder(next))
      toast.success('Orden de lecciones actualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el orden de las lecciones.')
    } finally {
      setDraggedLessonId(null)
      setReordering(false)
    }
  }

  async function removeLesson(lesson: DraftLesson) {
    if (!endpoint || !lesson.id || lesson.id.startsWith('draft:')) {
      toast.error('Esta lección todavía no se puede eliminar mediante la API directa.')
      return
    }
    try {
      const response = await fetch(`${endpoint}/${lesson.id}`, { method: 'DELETE' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.success) throw new Error(typeof body.error === 'string' ? body.error : 'No se pudo eliminar la lección.')
      onChange(await persistContiguousOrder(orderedLessons.filter((item) => item.id !== lesson.id)))
      toast.success('Lección eliminada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la lección.')
    }
  }

  return <section className={cardClass}><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-white">Lecciones</h2><p className="mt-1 text-sm text-white/50">Ordená el recorrido y abrí cada lección para editar su contenido.</p></div><button type="button" onClick={() => endpoint ? router.push(`${lessonBaseUrl}/lessons/new`) : toast.error('Guardá primero el contenedor para crear una lección.')} className="rounded-xl bg-ap-copper px-4 py-2 text-sm font-semibold text-white hover:brightness-110">+ Nueva lección</button></div><div className="mt-5 space-y-3">{orderedLessons.length === 0 ? <p className="rounded-xl border border-dashed border-white/20 px-4 py-6 text-sm text-white/45">Todavía no hay lecciones.</p> : orderedLessons.map((lesson) => { const canNavigate = Boolean(endpoint && lesson.id && !lesson.id.startsWith('draft:')); return <article key={lesson.clientId} draggable={canNavigate && !reordering} onDragStart={() => setDraggedLessonId(lesson.id ?? null)} onDragOver={(event) => event.preventDefault()} onDrop={() => void reorder(lesson.id ?? '')} onClick={() => canNavigate && router.push(lessonUrl(lesson))} className={`rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 transition ${canNavigate ? 'cursor-pointer hover:border-ap-copper/40 hover:bg-white/[0.07]' : 'opacity-70'}`}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="pt-0.5 text-lg leading-none text-white/30" aria-hidden="true">⋮⋮</span><div className="min-w-0"><span className="font-semibold text-white">{lesson.order + 1}. {lesson.title}</span><span className="mt-1 block truncate text-sm text-white/45">{lesson.videoFileUrl ? 'Video agregado' : lesson.description || 'Sin descripción'}</span></div></div><div className="flex shrink-0 items-center gap-3"><button type="button" onClick={(event) => { event.stopPropagation(); if (canNavigate) router.push(lessonUrl(lesson)) }} disabled={!canNavigate} className="text-sm text-ap-copper disabled:opacity-40">Editar</button><button type="button" onClick={(event) => { event.stopPropagation(); void removeLesson(lesson) }} disabled={!canNavigate} className="text-sm text-red-300 hover:text-red-200 disabled:opacity-40">Eliminar</button></div></div></article> })}</div></section>
}

function VideoUploadField({ courseId, label, value, onChange }: { courseId: string; label: string; value: string | null; onChange: (url: string | null) => void }) {
  return <MultipartVideoUploadField courseId={courseId} label={label} value={value} onChange={onChange} />
}

function LegacyStructurePanel({ courseTitle, busy, error, onChoose }: { courseTitle: string; busy: boolean; error: string | null; onChoose: (structure: CourseContentStructure) => void }) {
  const choices: Array<{ id: CourseContentStructure; title: string; description: string }> = [{ id: 'MODULES', title: 'Conservar como módulos', description: 'Mantiene cada módulo y sus lecciones como unidades independientes.' }, { id: 'STYLES', title: 'Convertir a estilos', description: 'Mueve el contenido de los módulos a lecciones directas de cada estilo.' }, { id: 'BOTH', title: 'Usar ambos', description: 'Conserva los módulos y abre una sección independiente para estilos.' }]
  return <div className="mx-auto max-w-4xl p-6 sm:p-8"><section className={`${cardClass} space-y-6`}><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ap-copper">Actualización necesaria</p><h1 className="mt-2 text-2xl font-semibold text-white">Elegí la estructura de {courseTitle}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Este curso fue creado con la organización anterior. Elegí cómo querés seguir sin publicar ni descartar contenido automáticamente.</p></div>{error ? <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p> : null}<div className="grid gap-4 md:grid-cols-3">{choices.map((choice) => <button key={choice.id} type="button" disabled={busy} onClick={() => onChoose(choice.id)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-ap-copper/50 hover:bg-ap-copper/10 disabled:opacity-50"><h2 className="font-semibold text-white">{busy ? 'Actualizando estructura…' : choice.title}</h2><p className="mt-2 text-sm leading-6 text-white/50">{choice.description}</p></button>)}</div></section></div>
}

function ExitDialog({ busy, onCancel, onSaveDraft, onPublish, onDiscard }: { busy: boolean; onCancel: () => void; onSaveDraft: () => void; onPublish: () => void; onDiscard: () => void }) {
  return <div role="dialog" aria-modal="true" aria-label="Cambios sin guardar" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-xl rounded-[28px] border border-white/15 bg-[#242522] p-7 shadow-2xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ap-copper">Cambios sin guardar</p><h2 className="mt-3 text-2xl font-semibold text-white">¿Qué querés hacer antes de salir?</h2><p className="mt-2 text-sm leading-6 text-white/60">El borrador es privado. Publicar actualiza la versión que ven las estudiantes.</p><div className="mt-7 grid gap-3"><button type="button" disabled={busy} onClick={onSaveDraft} className="rounded-xl border border-ap-copper/50 px-4 py-3 text-left font-medium text-ap-copper disabled:opacity-50">Guardar borrador</button><button type="button" disabled={busy} onClick={onPublish} className="rounded-xl bg-ap-copper px-4 py-3 text-left font-semibold text-white disabled:opacity-50">Guardar cambios y publicar</button><button type="button" disabled={busy} onClick={onDiscard} className="px-4 py-2 text-left text-red-300 disabled:opacity-50">Descartar cambios</button><button type="button" disabled={busy} onClick={onCancel} className="mt-1 px-4 py-2 text-white/60 disabled:opacity-50">Cancelar</button></div></div></div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-2"><span className="text-sm font-medium text-white/75">{label}</span>{children}</label>
}

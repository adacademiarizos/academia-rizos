'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import FileUploadProgress, { type UploadedFile } from '@/app/components/FileUploadProgress'

type Scope = 'COURSE' | 'MODULE' | 'STYLE' | 'LESSON'
type Resource = { id: string; title: string; fileUrl: string; fileType: string; fileSize: number }
type QuestionType = 'MULTIPLE_CHOICE' | 'WRITTEN' | 'PHOTO' | 'VIDEO'
type DraftQuestion = { type: QuestionType; title: string; options: string[]; correctAnswer: string }
type Assessment = { id: string; title: string; isRequired: boolean; isFinalExam: boolean; maxAttempts: number; questions: unknown[] }

const EMPTY_QUESTION: DraftQuestion = { type: 'MULTIPLE_CHOICE', title: '', options: ['', ''], correctAnswer: '' }

export function LearningContentManager({ scope, scopeId, courseId }: { scope: Scope; scopeId: string; courseId: string }) {
  const prefix = `/api/admin/learning/${scope}/${scopeId}`
  const [resources, setResources] = useState<Resource[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [pendingFile, setPendingFile] = useState<UploadedFile | null>(null)
  const [resourceTitle, setResourceTitle] = useState('')
  const [showResources, setShowResources] = useState(false)
  const [showAssessment, setShowAssessment] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [required, setRequired] = useState(false)
  const [finalExam, setFinalExam] = useState(false)
  const [maxAttempts, setMaxAttempts] = useState(1)
  const [passingScore, setPassingScore] = useState(70)
  const [questions, setQuestions] = useState<DraftQuestion[]>([{ ...EMPTY_QUESTION, options: ['', ''] }])

  const scopeLabel = useMemo(() => ({ COURSE: 'curso', MODULE: 'módulo', STYLE: 'estilo', LESSON: 'lección' }[scope]), [scope])

  const load = useCallback(async () => {
    const [resourceResponse, assessmentResponse] = await Promise.all([fetch(`${prefix}/resources`), fetch(`${prefix}/assessments`)])
    if (resourceResponse.ok) setResources((await resourceResponse.json()).data ?? [])
    if (assessmentResponse.ok) setAssessments((await assessmentResponse.json()).data ?? [])
  }, [prefix])

  useEffect(() => { void load() }, [load])

  const createResource = async () => {
    if (!pendingFile) return
    setSaving(true); setMessage(null)
    try {
      const response = await fetch(`${prefix}/resources`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: resourceTitle.trim() || pendingFile.fileName, fileUrl: pendingFile.fileUrl, fileType: pendingFile.fileType, fileSize: pendingFile.fileSize }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'No se pudo guardar el recurso.')
      setPendingFile(null); setResourceTitle(''); setMessage('Recurso añadido.'); await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar el recurso.') } finally { setSaving(false) }
  }

  const createAssessment = async () => {
    setSaving(true); setMessage(null)
    try {
      const payload = {
        title, description, isRequired: required || finalExam, isFinalExam: finalExam, maxAttempts, passingScore,
        questions: questions.map((question, index) => ({
          type: question.type, title: question.title, order: index,
          ...(question.type === 'MULTIPLE_CHOICE' ? { options: question.options.filter(Boolean), correctAnswer: question.correctAnswer } : {}),
        })),
      }
      const response = await fetch(`${prefix}/assessments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'No se pudo crear la evaluación.')
      setTitle(''); setDescription(''); setRequired(false); setFinalExam(false); setMaxAttempts(1); setPassingScore(70)
      setQuestions([{ ...EMPTY_QUESTION, options: ['', ''] }]); setMessage('Evaluación creada.'); await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo crear la evaluación.') } finally { setSaving(false) }
  }

  const removeResource = async (id: string) => {
    if (!confirm('¿Eliminar este recurso?')) return
    await fetch(`/api/admin/learning/resources/${id}`, { method: 'DELETE' }); await load()
  }
  const removeAssessment = async (id: string) => {
    if (!confirm('¿Eliminar esta evaluación y sus intentos?')) return
    await fetch(`/api/admin/assessments/${id}`, { method: 'DELETE' }); await load()
  }

  return <section className="border-t border-white/10 pt-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h4 className="text-sm font-medium text-white/80">Contenido de {scopeLabel}</h4><p className="text-xs text-white/40">Recursos y evaluaciones exclusivos de este contexto.</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => setShowResources((value) => !value)} className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/80 hover:bg-white/15">Recursos</button><button type="button" onClick={() => setShowAssessment((value) => !value)} className="text-xs px-3 py-1.5 rounded-lg bg-ap-copper text-white hover:bg-orange-700">+ Evaluación</button></div>
    </div>
    {message && <p className="text-xs text-ap-copper">{message}</p>}
    {showResources && <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
      {resources.length > 0 && <ul className="space-y-1">{resources.map((resource) => <li key={resource.id} className="flex justify-between gap-2 text-xs text-white/70"><a href={resource.fileUrl} target="_blank" rel="noreferrer" className="truncate hover:text-ap-copper">📎 {resource.title}</a><button type="button" onClick={() => void removeResource(resource.id)} className="text-red-400">Eliminar</button></li>)}</ul>}
      {pendingFile ? <div className="flex flex-wrap gap-2"><input value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} placeholder={pendingFile.fileName} className="flex-1 min-w-48 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-white"/><button type="button" disabled={saving} onClick={() => void createResource()} className="px-3 py-1 bg-ap-copper rounded-lg text-xs text-white disabled:opacity-50">Guardar recurso</button></div> : <FileUploadProgress uploadType="resource" courseId={courseId} deferPersistence onUploadComplete={setPendingFile}/>}
    </div>}
    {showAssessment && <div className="rounded-xl border border-ap-copper/30 bg-ap-copper/[0.04] p-3 space-y-3">
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título de la evaluación" className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white"/>
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Instrucciones (opcional)" rows={2} className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white"/>
      <div className="grid grid-cols-2 gap-2 text-xs text-white/70"><label className="flex gap-2 items-center"><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)}/> Obligatoria</label>{scope === 'COURSE' && <label className="flex gap-2 items-center"><input type="checkbox" checked={finalExam} onChange={(event) => { setFinalExam(event.target.checked); if (event.target.checked) setRequired(true) }}/> Examen final certificable</label>}<label>Intentos<input type="number" min={1} max={100} value={maxAttempts} onChange={(event) => setMaxAttempts(Number(event.target.value))} className="ml-2 w-14 bg-white/10 rounded px-1 text-white"/></label><label>Nota mínima<input type="number" min={0} max={100} value={passingScore} onChange={(event) => setPassingScore(Number(event.target.value))} className="ml-2 w-14 bg-white/10 rounded px-1 text-white"/></label></div>
      {questions.map((question, questionIndex) => <div key={questionIndex} className="border border-white/10 rounded-lg p-2 space-y-2"><div className="flex gap-2"><select value={question.type} onChange={(event) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, type: event.target.value as QuestionType, options: event.target.value === 'MULTIPLE_CHOICE' ? (item.options.length ? item.options : ['', '']) : [], correctAnswer: '' } : item))} className="bg-white/10 rounded px-1 text-xs text-white"><option value="MULTIPLE_CHOICE">Selección múltiple</option><option value="WRITTEN">Escrita</option><option value="PHOTO">Foto</option><option value="VIDEO">Video</option></select><input value={question.title} onChange={(event) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, title: event.target.value } : item))} placeholder="Pregunta" className="flex-1 bg-white/10 rounded px-2 py-1 text-xs text-white"/><button type="button" onClick={() => setQuestions((current) => current.filter((_, index) => index !== questionIndex))} className="text-xs text-red-400">×</button></div>
        {question.type === 'MULTIPLE_CHOICE' && <div className="space-y-1">{question.options.map((option, optionIndex) => <div key={optionIndex} className="flex gap-2"><input value={option} onChange={(event) => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, options: item.options.map((optionValue, i) => i === optionIndex ? event.target.value : optionValue) } : item))} placeholder={`Opción ${optionIndex + 1}`} className="flex-1 bg-white/10 rounded px-2 py-1 text-xs text-white"/><label className="text-xs text-white/60"><input type="radio" name={`correct-${questionIndex}`} checked={question.correctAnswer === option} onChange={() => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, correctAnswer: option } : item))}/> Correcta</label></div>)}<button type="button" onClick={() => setQuestions((current) => current.map((item, index) => index === questionIndex ? { ...item, options: [...item.options, ''] } : item))} className="text-xs text-ap-copper">+ opción</button></div>}</div>)}
      <div className="flex gap-2"><button type="button" onClick={() => setQuestions((current) => [...current, { ...EMPTY_QUESTION, options: ['', ''] }])} className="text-xs px-3 py-1 rounded bg-white/10 text-white/70">+ Pregunta</button><button type="button" disabled={saving} onClick={() => void createAssessment()} className="text-xs px-3 py-1 rounded bg-ap-copper text-white disabled:opacity-50">Guardar evaluación</button></div>
    </div>}
    {assessments.length > 0 && <ul className="space-y-1">{assessments.map((assessment) => <li key={assessment.id} className="flex items-center justify-between text-xs text-white/65"><span>{assessment.title} · {assessment.questions.length} preguntas · {assessment.maxAttempts} intento(s) {assessment.isRequired ? '· obligatoria' : ''} {assessment.isFinalExam ? '· final' : ''}</span><button type="button" onClick={() => void removeAssessment(assessment.id)} className="text-red-400">Eliminar</button></li>)}</ul>}
  </section>
}

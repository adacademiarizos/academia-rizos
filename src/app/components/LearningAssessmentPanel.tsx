'use client'

import { useCallback, useEffect, useState } from 'react'

type Scope = 'COURSE' | 'MODULE' | 'STYLE' | 'LESSON'
type Summary = { id: string; title: string; isRequired: boolean; isFinalExam: boolean; questionCount: number }
type Question = { id: string; type: 'MULTIPLE_CHOICE' | 'WRITTEN' | 'PHOTO' | 'VIDEO'; title: string; description?: string | null; required: boolean; options?: string[] | null }
type Detail = { assessment: { id: string; title: string; description?: string | null; isFinalExam: boolean; questions: Question[] }; remainingAttempts: number; canSubmit: boolean; waitingForReview: boolean; exhausted: boolean; unavailableReason: string | null; attempts: Array<{ id: string; status: string; score?: number | null; reviewNote?: string | null }> }
type Answer = { responseText?: string; fileUrl?: string; fileMimeType?: string }

export function LearningAssessmentPanel({ scope, scopeId, courseId, title = 'Evaluaciones' }: { scope: Scope; scopeId: string; courseId: string; title?: string }) {
  const [items, setItems] = useState<Summary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadItems = useCallback(async () => {
    const response = await fetch(`/api/student/learning/${scope}/${scopeId}/assessments`)
    if (response.ok) setItems((await response.json()).data ?? [])
  }, [scope, scopeId])
  const open = async (id: string) => {
    setActiveId(id); setDetail(null); setAnswers({}); setMessage(null)
    const response = await fetch(`/api/student/assessments/${id}`)
    const body = await response.json()
    if (response.ok) setDetail(body.data); else setMessage(body.error ?? 'No se pudo cargar la evaluación.')
  }
  useEffect(() => { void loadItems() }, [loadItems])

  const uploadEvidence = async (questionId: string, file: File) => {
    setMessage(null)
    const form = new FormData(); form.append('file', file); form.append('courseId', courseId)
    const response = await fetch('/api/student/uploads', { method: 'POST', body: form })
    const body = await response.json()
    if (!response.ok) { setMessage(body.error ?? 'No se pudo subir la evidencia.'); return }
    setAnswers((current) => ({ ...current, [questionId]: { fileUrl: body.data.fileUrl, fileMimeType: body.data.fileType } }))
  }
  const submit = async () => {
    if (!detail || !activeId) return
    setSubmitting(true); setMessage(null)
    try {
      const response = await fetch(`/api/student/assessments/${activeId}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, ...answer })) }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'No se pudo enviar la evaluación.')
      setMessage(body.data.status === 'PENDING_REVIEW' ? 'Enviada para corrección administrativa.' : body.data.status === 'APPROVED' ? '¡Evaluación aprobada!' : 'No aprobaste este intento. Revisa las instrucciones para intentar de nuevo.')
      await open(activeId)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo enviar la evaluación.') } finally { setSubmitting(false) }
  }

  if (items.length === 0) return null
  return <section className="rounded-2xl border border-zinc-700 bg-white/5 p-4 space-y-3">
    <h3 className="text-sm font-semibold text-ap-ivory">{title}</h3>
    <div className="space-y-2">{items.map((item) => <button type="button" key={item.id} onClick={() => void open(item.id)} className={`w-full text-left rounded-xl border p-3 transition ${item.id === activeId ? 'border-ap-copper bg-ap-copper/10' : 'border-zinc-700 hover:border-ap-copper/50'}`}><div className="flex gap-2 items-center"><span className="font-medium text-ap-ivory">{item.title}</span>{item.isFinalExam && <span className="text-[10px] px-2 py-0.5 rounded-full bg-ap-copper text-white">FINAL</span>}{item.isRequired && <span className="text-[10px] text-zinc-400">Obligatoria</span>}</div><p className="text-xs text-zinc-500 mt-1">{item.questionCount} pregunta(s)</p></button>)}</div>
    {message && <p className="text-sm text-ap-copper">{message}</p>}
    {detail && <div className="space-y-4 border-t border-zinc-700 pt-4"><div><h4 className="font-semibold text-ap-ivory">{detail.assessment.title}</h4>{detail.assessment.description && <p className="text-sm text-zinc-400 mt-1">{detail.assessment.description}</p>}<p className="text-xs text-zinc-500 mt-1">Intentos disponibles: {detail.remainingAttempts}</p></div>{detail.unavailableReason && <p className="rounded-lg bg-white/5 p-3 text-sm text-zinc-400">🔒 {detail.unavailableReason}</p>}{detail.waitingForReview && <p className="rounded-lg bg-ap-copper/10 p-3 text-sm text-ap-copper">⏳ Tu envío espera corrección administrativa.</p>}{detail.exhausted && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">Agotaste los intentos. Comunícate con administración para solicitar una revalidación.</p>}
      {detail.canSubmit && <div className="space-y-4">{detail.assessment.questions.map((question) => <div key={question.id} className="space-y-2"><p className="text-sm text-zinc-200">{question.title}{question.required && <span className="text-red-400"> *</span>}</p>{question.description && <p className="text-xs text-zinc-500">{question.description}</p>}{question.type === 'MULTIPLE_CHOICE' ? <div className="space-y-1">{question.options?.map((option) => <label key={option} className="flex gap-2 rounded-lg px-2 py-1 text-sm text-zinc-300 hover:bg-white/5"><input type="radio" name={question.id} checked={answers[question.id]?.responseText === option} onChange={() => setAnswers((current) => ({ ...current, [question.id]: { responseText: option } }))}/>{option}</label>)}</div> : question.type === 'WRITTEN' ? <textarea value={answers[question.id]?.responseText ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: { responseText: event.target.value } }))} rows={4} className="w-full rounded-lg border border-zinc-700 bg-black/20 p-2 text-sm text-white" placeholder="Escribe tu respuesta"/> : <div><input type="file" accept={question.type === 'PHOTO' ? 'image/*' : 'video/*'} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void uploadEvidence(question.id, file) }} className="text-sm text-zinc-400"/>{answers[question.id]?.fileUrl && <p className="text-xs text-green-400 mt-1">✓ Evidencia cargada</p>}</div>}</div>)}<button type="button" disabled={submitting} onClick={() => void submit()} className="rounded-xl bg-ap-copper px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{submitting ? 'Enviando…' : 'Enviar evaluación'}</button></div>}
      {detail.attempts.length > 0 && <div className="text-xs text-zinc-500">Último estado: {detail.attempts[0].status}{detail.attempts[0].reviewNote ? ` · ${detail.attempts[0].reviewNote}` : ''}</div>}</div>}
  </section>
}

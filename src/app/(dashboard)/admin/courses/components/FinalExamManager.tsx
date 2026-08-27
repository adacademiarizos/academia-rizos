"use client"

import { useCallback, useEffect, useState } from 'react'

type Question = { type: 'WRITTEN' | 'PHOTO' | 'VIDEO'; title: string; description?: string | null; required: boolean }
type Attempt = { id: string; status: 'PENDING_REVIEW' | 'APPROVED' | 'NOT_PASSED'; reviewNote: string | null; submittedAt: string; student: { id: string; name: string | null; email: string | null }; answers: Array<{ questionId: string; responseText: string | null; fileUrl: string | null }> }
type FinalExam = { id: string; title: string; description: string | null; maxAttempts: number; questions: Question[]; attempts: Attempt[] }

const emptyQuestion = (): Question => ({ type: 'WRITTEN', title: '', description: '', required: true })

export function FinalExamManager({ courseId }: { courseId: string }) {
  const [exam, setExam] = useState<FinalExam | null>(null)
  const [title, setTitle] = useState('Examen final')
  const [description, setDescription] = useState('')
  const [maxAttempts, setMaxAttempts] = useState(1)
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion()])
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/courses/${courseId}/final-exam`)
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'No fue posible cargar el examen final.')
    const existing = payload.data as FinalExam | null
    setExam(existing)
    if (existing) { setTitle(existing.title); setDescription(existing.description ?? ''); setMaxAttempts(existing.maxAttempts); setQuestions(existing.questions.length ? existing.questions : [emptyQuestion()]) }
  }, [courseId])
  useEffect(() => { load().catch((error) => setMessage(error instanceof Error ? error.message : 'No fue posible cargar el examen final.')) }, [load])

  const save = async () => {
    if (!title.trim() || questions.some((question) => !question.title.trim())) { setMessage('Agrega un título y el contenido de cada pregunta.'); return }
    setSaving(true); setMessage(null)
    try {
      const response = await fetch(`/api/admin/courses/${courseId}/final-exam`, { method: exam ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description: description || null, maxAttempts, questions }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No fue posible guardar el examen final.')
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No fue posible guardar el examen final.') } finally { setSaving(false) }
  }

  const review = async (attemptId: string, status: 'APPROVED' | 'NOT_PASSED') => {
    const reviewNote = window.prompt(status === 'APPROVED' ? 'Comentario para la persona (opcional)' : 'Explica qué debe mejorar (opcional)')
    const response = await fetch(`/api/admin/courses/${courseId}/final-exam/attempts/${attemptId}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, reviewNote }) })
    const payload = await response.json()
    if (!response.ok) { setMessage(payload.error || 'No fue posible corregir el intento.'); return }
    await load()
  }

  const revalidate = async (userId: string) => {
    const response = await fetch(`/api/admin/courses/${courseId}/final-exam/revalidations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, attemptsGranted: 1 }) })
    const payload = await response.json()
    if (!response.ok) { setMessage(payload.error || 'No fue posible habilitar otro intento.'); return }
    setMessage('Se habilitó un nuevo intento para la persona.')
  }

  const hasAttempts = (exam?.attempts.length ?? 0) > 0
  return <section className="mt-10 rounded-[28px] border border-ap-copper/30 bg-ap-copper/5 p-6 space-y-5">
    <div><p className="text-xs font-semibold uppercase tracking-wider text-ap-copper">Evaluación de cierre</p><h2 className="mt-1 text-xl font-semibold text-white">Examen final del curso</h2><p className="mt-1 text-sm text-white/50">Se corrige manualmente. El siguiente intento solo se habilita cuando marques el anterior como no aprobado.</p></div>
    {message && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{message}</p>}
    {!hasAttempts && <div className="space-y-3 rounded-2xl border border-white/10 bg-black/10 p-4">
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título del examen" className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white" />
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Instrucciones (opcional)" rows={2} className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white" />
      <label className="block text-xs text-white/60">Intentos base<input type="number" min={1} max={50} value={maxAttempts} onChange={(event) => setMaxAttempts(Number(event.target.value) || 1)} className="mt-1 block rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white" /></label>
      {questions.map((question, index) => <div key={index} className="space-y-2 rounded-xl border border-white/10 p-3"><div className="flex gap-2"><select value={question.type} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as Question['type'] } : item))} className="rounded-lg border border-white/20 bg-ap-ink px-2 text-xs text-white"><option value="WRITTEN">Respuesta escrita</option><option value="PHOTO">Foto</option><option value="VIDEO">Video</option></select>{questions.length > 1 && <button type="button" onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="ml-auto text-xs text-red-300">Eliminar</button>}</div><input value={question.title} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} placeholder={`Pregunta ${index + 1}`} className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white" /><textarea value={question.description ?? ''} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} placeholder="Indicaciones (opcional)" rows={2} className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white" /></div>)}
      <button type="button" onClick={() => setQuestions((current) => [...current, emptyQuestion()])} className="text-sm text-ap-copper">+ Añadir pregunta</button><button type="button" onClick={save} disabled={saving} className="w-full rounded-lg bg-ap-copper py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : exam ? 'Guardar cambios' : 'Crear examen final'}</button>
    </div>}
    {hasAttempts && <div className="space-y-3"><p className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">Las preguntas están protegidas porque ya hay intentos registrados. Puedes corregirlos y habilitar revalidaciones.</p>{exam?.attempts.map((attempt) => <article key={attempt.id} className="rounded-xl border border-white/10 bg-black/10 p-4 space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium text-white">{attempt.student.name ?? attempt.student.email ?? 'Estudiante'}</p><p className="text-xs text-white/45">{new Date(attempt.submittedAt).toLocaleString()}</p></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/80">{attempt.status}</span></div><div className="space-y-2">{attempt.answers.map((answer) => <div key={answer.questionId} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white/75">{answer.responseText || (answer.fileUrl ? <a className="text-ap-copper underline" href={answer.fileUrl} target="_blank" rel="noreferrer">Ver evidencia</a> : 'Sin respuesta')}</div>)}</div>{attempt.status === 'PENDING_REVIEW' && <div className="flex gap-2"><button type="button" onClick={() => review(attempt.id, 'APPROVED')} className="rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200">Aprobar</button><button type="button" onClick={() => review(attempt.id, 'NOT_PASSED')} className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-200">No aprobó</button></div>}{attempt.status === 'NOT_PASSED' && <button type="button" onClick={() => revalidate(attempt.student.id)} className="text-xs font-medium text-ap-copper">Habilitar 1 intento adicional</button>}</article>)}</div>}
  </section>
}

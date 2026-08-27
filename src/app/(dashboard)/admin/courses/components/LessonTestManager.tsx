"use client"

import { useCallback, useEffect, useState } from 'react'

type TestQuestion = { title: string; options: string[]; correctAnswer: string }
type LessonTest = { id: string; title: string; description: string | null; maxAttempts: number; passingScore: number; questions: TestQuestion[]; submissionCount: number }

const emptyQuestion = (): TestQuestion => ({ title: '', options: ['', ''], correctAnswer: '' })

export function LessonTestManager({ lessonId }: { lessonId: string }) {
  const [tests, setTests] = useState<LessonTest[]>([])
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [maxAttempts, setMaxAttempts] = useState(1)
  const [passingScore, setPassingScore] = useState(70)
  const [questions, setQuestions] = useState<TestQuestion[]>([emptyQuestion()])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/lessons/${lessonId}/tests`)
    const payload = await response.json()
    if (response.ok) setTests(payload.data ?? [])
  }, [lessonId])
  useEffect(() => { load().catch(() => setMessage('No fue posible cargar los tests.')) }, [load])

  const updateQuestion = (index: number, update: Partial<TestQuestion>) => {
    setQuestions((current) => current.map((question, currentIndex) => currentIndex === index ? { ...question, ...update } : question))
  }

  const createTest = async () => {
    if (!title.trim() || questions.some((question) => !question.title.trim() || question.options.some((option) => !option.trim()) || !question.correctAnswer)) {
      setMessage('Completa el título y cada pregunta, opción y respuesta correcta.')
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/admin/lessons/${lessonId}/tests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: description || null, maxAttempts, passingScore, questions }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No fue posible crear el test.')
      setTitle(''); setDescription(''); setMaxAttempts(1); setPassingScore(70); setQuestions([emptyQuestion()]); setOpen(false)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible crear el test.')
    } finally { setSaving(false) }
  }

  const remove = async (testId: string) => {
    if (!confirm('¿Eliminar este test y todas sus preguntas?')) return
    const response = await fetch(`/api/admin/lessons/${lessonId}/tests/${testId}`, { method: 'DELETE' })
    const payload = await response.json()
    if (!response.ok) { setMessage(payload.error || 'No fue posible eliminar el test.'); return }
    await load()
  }

  return <section className="mt-4 border-t border-white/10 pt-4 space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div><h4 className="text-sm font-semibold text-white">Tests de esta lección</h4><p className="text-xs text-white/45">Selección múltiple; define intentos y nota mínima.</p></div>
      <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-lg bg-ap-copper px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700">{open ? 'Cancelar' : '+ Añadir test'}</button>
    </div>
    {message && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">{message}</p>}
    {open && <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título del test" className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-ap-copper/50" />
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descripción (opcional)" rows={2} className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-ap-copper/50" />
      <div className="grid grid-cols-2 gap-3"><label className="text-xs text-white/60">Intentos<input type="number" min={1} max={50} value={maxAttempts} onChange={(event) => setMaxAttempts(Number(event.target.value) || 1)} className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-white" /></label><label className="text-xs text-white/60">Nota mínima (%)<input type="number" min={0} max={100} value={passingScore} onChange={(event) => setPassingScore(Number(event.target.value) || 0)} className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-white" /></label></div>
      {questions.map((question, questionIndex) => <div key={questionIndex} className="space-y-2 rounded-lg border border-white/10 p-3"><div className="flex gap-2"><input value={question.title} onChange={(event) => updateQuestion(questionIndex, { title: event.target.value })} placeholder={`Pregunta ${questionIndex + 1}`} className="flex-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white" />{questions.length > 1 && <button type="button" onClick={() => setQuestions((current) => current.filter((_, index) => index !== questionIndex))} className="text-xs text-red-300">Eliminar</button>}</div>{question.options.map((option, optionIndex) => <label key={optionIndex} className="flex items-center gap-2 text-xs text-white/60"><input type="radio" name={`correct-${questionIndex}`} checked={question.correctAnswer === option && !!option} onChange={() => updateQuestion(questionIndex, { correctAnswer: option })} /><input value={option} onChange={(event) => { const options = [...question.options]; options[optionIndex] = event.target.value; updateQuestion(questionIndex, { options, correctAnswer: question.correctAnswer === option ? event.target.value : question.correctAnswer }) }} placeholder={`Opción ${optionIndex + 1}`} className="flex-1 rounded-md border border-white/20 bg-white/10 px-2 py-1 text-sm text-white" /></label>)}</div>)}
      <button type="button" onClick={() => setQuestions((current) => [...current, emptyQuestion()])} className="text-xs text-ap-copper">+ Añadir pregunta</button>
      <button type="button" onClick={createTest} disabled={saving} className="w-full rounded-lg bg-ap-copper py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar test'}</button>
    </div>}
    {tests.length === 0 ? <p className="text-xs italic text-white/35">Sin tests configurados.</p> : <div className="space-y-2">{tests.map((test) => <div key={test.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/10 px-3 py-2"><div><p className="text-sm text-white">{test.title}</p><p className="text-xs text-white/45">{test.questions.length} preguntas · {test.maxAttempts} intentos · {test.passingScore}% · {test.submissionCount} entregas</p></div><button type="button" onClick={() => remove(test.id)} className="text-xs text-red-300 hover:text-red-200">Eliminar</button></div>)}</div>}
  </section>
}

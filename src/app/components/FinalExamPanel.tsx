"use client"

import { useCallback, useEffect, useState } from 'react'

type FinalQuestion = {
  id: string
  type: 'WRITTEN' | 'PHOTO' | 'VIDEO' | 'MULTIPLE_CHOICE'
  title: string
  description: string | null
  required: boolean
  order: number
  /** Present only for MULTIPLE_CHOICE. The correct answer is never sent here. */
  options?: string[] | null
}

type FinalExamData = {
  finalExam: { id: string; title: string; description: string | null; questions: FinalQuestion[] } | null
  progress: { totalLessons: number; completedLessons: number; percentage: number; isComplete: boolean }
  attemptsAllowed?: number
  attemptsUsed?: number
  attemptsRemaining?: number
  pendingAttempt?: { id: string } | null
  approvedAttempt?: { id: string } | null
  canSubmit: boolean
  reason: string | null
}

type Evidence = { fileUrl: string; fileMimeType: string }

const reasonMessage: Record<string, string> = {
  LESSONS_INCOMPLETE: 'Completa todas las lecciones y sus tests antes de presentar el examen final.',
  PENDING_REVIEW: 'Tu entrega está pendiente de corrección por administración.',
  CONTACT_ADMINISTRATION: 'Agotaste tus intentos. Comunícate con administración para solicitar una revalidación.',
  ALREADY_APPROVED: 'Examen final aprobado. Tu certificado ya está disponible.',
  FINAL_EXAM_NOT_CONFIGURED: 'El examen final aún no ha sido configurado.',
}

export function FinalExamPanel({ courseId }: { courseId: string }) {
  const [data, setData] = useState<FinalExamData | null>(null)
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({})
  const [evidence, setEvidence] = useState<Record<string, Evidence>>({})
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch(`/api/student/courses/${courseId}/final-exam`)
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'No fue posible cargar el examen final.')
    setData(payload.data)
  }, [courseId])

  useEffect(() => {
    load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'No fue posible cargar el examen final.'))
  }, [courseId, load])

  const uploadEvidence = async (questionId: string, file: File) => {
    setUploadingQuestionId(questionId)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('courseId', courseId)
      formData.append('file', file)
      const response = await fetch('/api/student/uploads', { method: 'POST', body: formData })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No fue posible subir el archivo.')
      setEvidence((current) => ({ ...current, [questionId]: { fileUrl: payload.data.fileUrl, fileMimeType: payload.data.fileType } }))
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'No fue posible subir el archivo.')
    } finally {
      setUploadingQuestionId(null)
    }
  }

  const submit = async () => {
    if (!data?.finalExam) return
    const answers = data.finalExam.questions.map((question) => ({
      questionId: question.id,
      responseText: textAnswers[question.id] ?? null,
      fileUrl: evidence[question.id]?.fileUrl ?? null,
      fileMimeType: evidence[question.id]?.fileMimeType ?? null,
    }))
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`/api/student/courses/${courseId}/final-exam/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No fue posible enviar el examen.')
      setTextAnswers({})
      setEvidence({})
      await load()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No fue posible enviar el examen.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!data && !error) return <div className="mt-8 border-t border-zinc-700 pt-8 text-sm text-zinc-500">Cargando examen final…</div>

  const exam = data?.finalExam
  if (!exam) return null

  return (
    <section className="mt-8 border-t border-zinc-700 pt-8">
      <div className="rounded-2xl border border-ap-copper/30 bg-gradient-to-br from-ap-copper/10 to-ap-olive/10 p-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ap-copper">Evaluación del curso</p>
            <h2 className="mt-1 text-xl font-bold text-ap-ivory">{exam.title}</h2>
            {exam.description && <p className="mt-1 text-sm text-zinc-300">{exam.description}</p>}
          </div>
          {data.approvedAttempt ? <span className="w-fit rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">Aprobado</span> : <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300">{data.attemptsRemaining ?? 0} intento{data.attemptsRemaining === 1 ? '' : 's'} disponible{data.attemptsRemaining === 1 ? '' : 's'}</span>}
        </div>

        {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>}

        {!data.canSubmit && <p className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-zinc-300">{reasonMessage[data.reason ?? ''] ?? 'El examen final no está disponible en este momento.'}</p>}

        {data.canSubmit && (
          <div className="space-y-5">
            <p className="text-sm text-zinc-300">Intento {((data.attemptsUsed ?? 0) + 1)} de {data.attemptsAllowed}. Administración corregirá tu entrega antes de habilitar otro intento.</p>
            {exam.questions.map((question, index) => (
              <div key={question.id} className="space-y-2 rounded-xl border border-white/10 bg-black/10 p-4">
                <label className="block text-sm font-semibold text-ap-ivory">{index + 1}. {question.title}{question.required && <span className="ml-1 text-ap-copper">*</span>}</label>
                {question.description && <p className="text-sm text-zinc-400">{question.description}</p>}
                {question.type === 'MULTIPLE_CHOICE' ? (
                  <div className="space-y-2">
                    {(question.options ?? []).map((option) => (
                      <label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-ap-ivory transition hover:border-ap-copper/50">
                        <input
                          type="radio"
                          name={`final-question-${question.id}`}
                          checked={textAnswers[question.id] === option}
                          onChange={() => setTextAnswers((current) => ({ ...current, [question.id]: option }))}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                ) : question.type === 'WRITTEN' ? (
                  <textarea value={textAnswers[question.id] ?? ''} onChange={(event) => setTextAnswers((current) => ({ ...current, [question.id]: event.target.value }))} rows={5} className="w-full rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-ap-ivory outline-none transition focus:border-ap-copper/70" placeholder="Escribe tu respuesta…" />
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <input type="file" accept={question.type === 'PHOTO' ? 'image/*' : 'video/*'} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadEvidence(question.id, file) }} disabled={uploadingQuestionId === question.id} className="max-w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-ap-copper/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ap-copper hover:file:bg-ap-copper/30" />
                    {uploadingQuestionId === question.id && <span className="text-sm text-zinc-400">Subiendo…</span>}
                    {evidence[question.id] && <span className="text-sm text-emerald-300">✓ Evidencia lista</span>}
                  </div>
                )}
              </div>
            ))}
            <button onClick={submit} disabled={submitting || uploadingQuestionId !== null} className="w-full rounded-xl bg-ap-copper px-4 py-3 text-sm font-bold text-ap-ink transition hover:bg-ap-copper/90 disabled:opacity-50">
              {submitting ? 'Enviando para corrección…' : 'Enviar examen para corrección'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

"use client"

import { useCallback, useEffect, useState } from 'react'

type LessonTestQuestion = {
  id: string
  title: string
  description: string | null
  order: number
  options: string[]
}

type LessonTest = {
  id: string
  title: string
  description: string | null
  maxAttempts: number
  passingScore: number
  questions: LessonTestQuestion[]
  attemptsUsed: number
  attemptsRemaining: number
  isPassed: boolean
  canSubmit: boolean
  latestSubmission: { score: number; isPassed: boolean } | null
}

type LessonAssessmentData = {
  lessonCompletedAt: string | null
  tests: LessonTest[]
}

export function LessonAssessmentPanel({ lessonId, onCompleted }: { lessonId: string; onCompleted?: () => void }) {
  const [data, setData] = useState<LessonAssessmentData | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submittingTestId, setSubmittingTestId] = useState<string | null>(null)
  // Collapsed by default: a wall of open forms hides everything else on the page.
  const [openTestId, setOpenTestId] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const response = await fetch(`/api/student/lessons/${lessonId}/tests`)
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'No fue posible cargar las evaluaciones.')
    setData(payload.data)
  }, [lessonId])

  useEffect(() => {
    setData(null)
    setAnswers({})
    load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'No fue posible cargar las evaluaciones.'))
  }, [lessonId, load])

  const completeLesson = async () => {
    setCompleting(true)
    setError(null)
    try {
      const response = await fetch(`/api/student/lessons/${lessonId}/progress`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No fue posible completar la lección.')
      await load()
      // Lets the player tick this lesson in its sidebar without a full reload.
      onCompleted?.()
    } catch (completionError) {
      setError(completionError instanceof Error ? completionError.message : 'No fue posible completar la lección.')
    } finally {
      setCompleting(false)
    }
  }

  const submitTest = async (test: LessonTest) => {
    const unanswered = test.questions.some((question) => !answers[question.id])
    if (unanswered) {
      setError('Selecciona una respuesta para cada pregunta antes de enviar el test.')
      return
    }
    setSubmittingTestId(test.id)
    setError(null)
    try {
      const testAnswers = Object.fromEntries(test.questions.map((question) => [question.id, answers[question.id]]))
      const response = await fetch(`/api/student/lessons/${lessonId}/tests/${test.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: testAnswers }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No fue posible enviar el test.')
      setAnswers({})
      // Collapse again so the result is what the student sees next, not the
      // form they just filled in.
      setOpenTestId(null)
      await load()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No fue posible enviar el test.')
    } finally {
      setSubmittingTestId(null)
    }
  }

  if (!data && !error) return <div className="text-sm text-zinc-500">Cargando evaluaciones de la lección…</div>

  const lessonCompleted = !!data?.lessonCompletedAt
  const tests = data?.tests ?? []
  const allTestsPassed = tests.length > 0 && tests.every((test) => test.isPassed)

  return (
    <section className="rounded-2xl border border-zinc-700 bg-white/5 p-5 space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ap-copper">Progreso de la lección</p>
          <h3 className="mt-1 text-lg font-bold text-ap-ivory">{lessonCompleted ? 'Lección completada' : tests.length ? 'Completa los tests para finalizar' : 'Marca la lección al terminarla'}</h3>
          {tests.length > 0 && <p className="mt-1 text-sm text-zinc-400">Todos los tests deben aprobarse para registrar esta lección.</p>}
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${lessonCompleted ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-700/70 text-zinc-300'}`}>
          {lessonCompleted ? '✓ Completada' : 'En progreso'}
        </span>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}

      {tests.map((test) => (
        <article key={test.id} className="rounded-xl border border-white/10 bg-black/10 p-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="font-semibold text-ap-ivory">{test.title}</h4>
              {test.description && <p className="mt-1 text-sm text-zinc-400">{test.description}</p>}
            </div>
            <span className={`w-fit rounded-full px-2.5 py-1 text-xs ${test.isPassed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-ap-copper/15 text-ap-copper'}`}>
              {test.isPassed ? 'Aprobado' : `${test.attemptsRemaining} intento${test.attemptsRemaining === 1 ? '' : 's'} disponible${test.attemptsRemaining === 1 ? '' : 's'}`}
            </span>
          </div>

          {/* Passing and failing get the same visual weight: a plain grey line
              for a failed attempt reads as a footnote, not as a result. */}
          {test.latestSubmission && (
            <div className={`rounded-xl border p-4 ${test.isPassed ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span aria-hidden="true" className={`text-lg ${test.isPassed ? 'text-emerald-300' : 'text-red-300'}`}>{test.isPassed ? '✓' : '✕'}</span>
                <p className={`font-semibold ${test.isPassed ? 'text-emerald-300' : 'text-red-300'}`}>
                  {test.isPassed ? 'Aprobaste este test' : 'No alcanzaste la nota mínima'}
                </p>
                <span className={`ml-auto rounded-full bg-black/25 px-3 py-1 text-sm font-bold ${test.isPassed ? 'text-emerald-300' : 'text-red-300'}`}>
                  {Math.round(test.latestSubmission.score)}%
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                Nota mínima requerida: {test.passingScore}%
                {!test.isPassed && test.attemptsRemaining > 0 && ` · Te ${test.attemptsRemaining === 1 ? 'queda 1 intento' : `quedan ${test.attemptsRemaining} intentos`}`}
              </p>
            </div>
          )}

          {!test.isPassed && test.canSubmit && (
            <button
              type="button"
              onClick={() => { setOpenTestId((current) => current === test.id ? null : test.id); setAnswers({}); setError(null) }}
              className="w-full rounded-lg border border-ap-copper/50 px-4 py-2 text-sm font-semibold text-ap-copper transition hover:bg-ap-copper/10"
            >
              {openTestId === test.id ? 'Cerrar' : test.latestSubmission ? 'Volver a intentar' : 'Comenzar test'}
            </button>
          )}

          {!test.isPassed && test.canSubmit && openTestId === test.id && (
            <div className="space-y-4">
              {test.questions.map((question, index) => (
                <fieldset key={question.id} className="space-y-2">
                  <legend className="text-sm font-medium text-zinc-200">{index + 1}. {question.title}</legend>
                  {question.description && <p className="text-xs text-zinc-500">{question.description}</p>}
                  <div className="grid gap-2">
                    {question.options.map((option) => (
                      <label key={option} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${answers[question.id] === option ? 'border-ap-copper/70 bg-ap-copper/10 text-ap-ivory' : 'border-white/10 text-zinc-300 hover:border-white/25'}`}>
                        <input type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} className="accent-ap-copper" />
                        {option}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <button onClick={() => submitTest(test)} disabled={submittingTestId === test.id} className="rounded-lg bg-ap-copper px-4 py-2 text-sm font-semibold text-ap-ink transition hover:bg-ap-copper/90 disabled:opacity-50">
                {submittingTestId === test.id ? 'Enviando…' : `Enviar test (${test.attemptsUsed + 1}/${test.maxAttempts})`}
              </button>
            </div>
          )}
          {!test.isPassed && !test.canSubmit && <p className="text-sm text-amber-200">Agotaste los intentos de este test. Comunícate con administración si necesitas ayuda.</p>}
        </article>
      ))}

      {!lessonCompleted && (tests.length === 0 || allTestsPassed) && (
        <button onClick={completeLesson} disabled={completing} className="w-full rounded-xl bg-ap-copper px-4 py-3 text-sm font-bold text-ap-ink transition hover:bg-ap-copper/90 disabled:opacity-50">
          {completing ? 'Guardando…' : 'Marcar lección como completada'}
        </button>
      )}
    </section>
  )
}

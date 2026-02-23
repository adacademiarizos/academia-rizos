'use client'

import { useState, useEffect } from 'react'

interface Question {
  id: string
  type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'FILE_UPLOAD' | 'WRITTEN'
  title: string
  description?: string
  config: Record<string, any>
}

interface AttemptInfo {
  attemptsUsed: number
  maxAttempts: number
  attemptsRemaining: number | null
  bestScore: number | null
  alreadyPassed: boolean
  passingScore: number
}

interface ModuleTestSubmissionProps {
  moduleId: string
  testId: string
  testTitle: string
  onComplete?: (result: { score: number; isPassed: boolean }) => void
}

export default function ModuleTestSubmission({
  moduleId,
  testId,
  testTitle,
  onComplete,
}: ModuleTestSubmissionProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [attemptInfo, setAttemptInfo] = useState<AttemptInfo | null>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<null | {
    success: boolean
    score: number
    isPassed: boolean
    correctCount: number
    totalQuestions: number
    passingScore: number
    attemptNumber: number
    attemptsUsed: number
    attemptsRemaining: number | null
    maxAttempts: number
    message: string
  }>(null)

  useEffect(() => {
    fetchQuestionsAndStatus()
  }, [testId])

  const fetchQuestionsAndStatus = async () => {
    try {
      setIsLoading(true)
      const [questionsRes, statusRes] = await Promise.all([
        fetch(`/api/student/modules/${moduleId}/tests/${testId}/questions`),
        fetch(`/api/student/modules/${moduleId}/tests/${testId}/status`),
      ])

      if (!questionsRes.ok) throw new Error('Error al cargar las preguntas')
      if (!statusRes.ok) throw new Error('Error al cargar el estado del test')

      const questionsData = await questionsRes.json()
      const statusData = await statusRes.json()

      setQuestions(questionsData.data || [])
      setAttemptInfo(statusData.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando el test')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers({ ...answers, [questionId]: value })
  }

  const handleSubmit = async () => {
    const unanswered = questions.filter((q) => !answers[q.id])
    if (unanswered.length > 0) {
      setError(`Por favor responde todas las preguntas (${unanswered.length} sin responder)`)
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const response = await fetch(
        `/api/student/modules/${moduleId}/tests/${testId}/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar el test')
      }

      setResult(data.data)

      if (onComplete) {
        onComplete({ score: data.data.score, isPassed: data.data.isPassed })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el test')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTryAgain = async () => {
    setResult(null)
    setAnswers({})
    setError(null)
    // Refresh status to get updated attempt count
    try {
      const statusRes = await fetch(
        `/api/student/modules/${moduleId}/tests/${testId}/status`
      )
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setAttemptInfo(statusData.data)
      }
    } catch {
      // Non-critical
    }
  }

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Cargando test...</div>
  }

  // Show result screen
  if (result) {
    const canRetry =
      result.maxAttempts === 0 || (result.attemptsRemaining !== null && result.attemptsRemaining > 0)

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div
          className={`rounded-lg p-8 text-center ${
            result.isPassed
              ? 'bg-green-50 border-2 border-green-200'
              : 'bg-red-50 border-2 border-red-200'
          }`}
        >
          <div
            className={`text-5xl mb-4 ${
              result.isPassed ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {result.isPassed ? '✓' : '✗'}
          </div>

          <h2
            className={`text-2xl font-bold mb-2 ${
              result.isPassed ? 'text-green-900' : 'text-red-900'
            }`}
          >
            {result.message}
          </h2>

          <div className="space-y-1 text-gray-700 mb-4">
            <p className="text-3xl font-bold">{Math.round(result.score)}%</p>
            <p>
              Correctas: {result.correctCount} / {result.totalQuestions}
            </p>
            <p className="text-sm text-gray-500">
              Puntaje mínimo: {result.passingScore}%
            </p>
          </div>

          {/* Attempt indicator */}
          <div className="mb-6 text-sm text-gray-600">
            {result.maxAttempts === 0 ? (
              <span>Intento {result.attemptNumber} (intentos ilimitados)</span>
            ) : (
              <span>
                Intento {result.attemptsUsed} de {result.maxAttempts}
                {result.attemptsRemaining !== null && result.attemptsRemaining > 0
                  ? ` · ${result.attemptsRemaining} intento${result.attemptsRemaining !== 1 ? 's' : ''} restante${result.attemptsRemaining !== 1 ? 's' : ''}`
                  : ' · Sin intentos restantes'}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {!result.isPassed && canRetry && (
              <button
                onClick={handleTryAgain}
                className="w-full px-4 py-2 bg-ap-copper text-white rounded hover:bg-orange-700 transition"
              >
                Intentar de nuevo
              </button>
            )}
            <button
              onClick={() => window.history.back()}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition"
            >
              Volver al módulo
            </button>
          </div>
        </div>
      </div>
    )
  }

  const noAttemptsLeft =
    attemptInfo !== null &&
    attemptInfo.maxAttempts > 0 &&
    attemptInfo.attemptsRemaining !== null &&
    attemptInfo.attemptsRemaining <= 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border-b-2 border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">{testTitle}</h1>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600">
          <span>{questions.length} preguntas</span>
          {attemptInfo && (
            <>
              <span>·</span>
              <span>Puntaje mínimo: {attemptInfo.passingScore}%</span>
              <span>·</span>
              {attemptInfo.maxAttempts === 0 ? (
                <span className="text-green-600 font-medium">Intentos ilimitados</span>
              ) : (
                <span
                  className={noAttemptsLeft ? 'text-red-600 font-medium' : 'text-gray-600'}
                >
                  Intento {attemptInfo.attemptsUsed + 1} de {attemptInfo.maxAttempts}
                </span>
              )}
            </>
          )}
        </div>

        {/* Already passed banner */}
        {attemptInfo?.alreadyPassed && (
          <div className="mt-3 px-4 py-2 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
            ✓ Ya aprobaste este test
            {attemptInfo.bestScore !== null &&
              ` — mejor puntaje: ${Math.round(attemptInfo.bestScore)}%`}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* No attempts remaining */}
      {noAttemptsLeft ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-4xl">🔒</p>
          <p className="text-lg font-semibold text-gray-700">Sin intentos restantes</p>
          <p className="text-gray-500">
            Usaste todos tus {attemptInfo!.maxAttempts} intento
            {attemptInfo!.maxAttempts !== 1 ? 's' : ''} para este test.
          </p>
          {attemptInfo!.bestScore !== null && (
            <p className="text-gray-600">
              Mejor puntaje:{' '}
              <span className="font-bold">{Math.round(attemptInfo!.bestScore)}%</span>
            </p>
          )}
          <button
            onClick={() => window.history.back()}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition"
          >
            Volver al módulo
          </button>
        </div>
      ) : (
        <>
          {/* Questions */}
          <div className="space-y-6">
            {questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                index={index}
                question={question}
                answer={answers[question.id]}
                onAnswerChange={(value) => handleAnswerChange(question.id, value)}
              />
            ))}
          </div>

          {/* Submit button */}
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-ap-copper text-white rounded font-medium hover:bg-orange-700 disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar respuestas'}
            </button>
            <button
              onClick={() => window.history.back()}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded font-medium hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Question Card Component
interface QuestionCardProps {
  index: number
  question: Question
  answer: any
  onAnswerChange: (value: any) => void
}

function QuestionCard({ index, question, answer, onAnswerChange }: QuestionCardProps) {
  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {index + 1}. {question.title}
        </h3>
        {question.description && (
          <p className="text-gray-600 text-sm mt-1">{question.description}</p>
        )}
      </div>

      <div className="mt-4">
        {question.type === 'MULTIPLE_CHOICE' && (
          <div className="space-y-2">
            {(question.config.options || []).map((option: string, optIdx: number) => (
              <label key={`${question.id}-opt-${optIdx}`} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  value={option}
                  checked={answer === option}
                  onChange={(e) => onAnswerChange(e.target.value)}
                  className="rounded border-gray-300"
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        )}

        {question.type === 'SHORT_ANSWER' && (
          <input
            type="text"
            value={answer || ''}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Escribe tu respuesta"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-ap-copper"
          />
        )}

        {question.type === 'WRITTEN' && (
          <textarea
            value={answer || ''}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Escribe tu respuesta aquí..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-ap-copper"
          />
        )}

        {question.type === 'FILE_UPLOAD' && (
          <div>
            <input
              type="file"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onload = (event) => {
                    onAnswerChange({
                      fileName: file.name,
                      fileSize: file.size,
                      fileContent: event.target?.result,
                    })
                  }
                  reader.readAsArrayBuffer(file)
                }
              }}
              className="block w-full"
              accept={question.config.allowedMimeTypes?.join(',') || '*'}
            />
            {answer && (
              <p className="text-sm text-gray-600 mt-2">
                ✓ {answer.fileName} ({(answer.fileSize / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

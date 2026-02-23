'use client'

import { useState, useEffect } from 'react'

interface Question {
  id: string
  type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'FILE_UPLOAD' | 'WRITTEN'
  title: string
  description?: string
  config: Record<string, any>
}

interface ExamSubmissionProps {
  courseId: string
  courseTitle: string
  onComplete?: (result: { score: number; isPassed: boolean; certificateCode?: string }) => void
}

export default function ExamSubmission({
  courseId,
  courseTitle,
  onComplete,
}: ExamSubmissionProps) {
  const [exam, setExam] = useState<{ id: string; title: string; passingScore: number } | null>(
    null
  )
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<null | {
    success: boolean
    score: number
    isPassed: boolean
    correctCount: number
    totalAutoGradedQuestions: number
    certificateCode?: string
    message: string
  }>(null)

  // Fetch exam and questions
  useEffect(() => {
    fetchExam()
  }, [courseId])

  const fetchExam = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/admin/courses/${courseId}/exam`)

      if (!response.ok) throw new Error('Failed to load exam')
      const data = await response.json()

      if (!data.data) {
        setError('No exam configured for this course')
        return
      }

      setExam(data.data)
      setQuestions(data.data.questions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading exam')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers({ ...answers, [questionId]: value })
  }

  const handleSubmit = async () => {
    // Validate all questions answered
    const unanswered = questions.filter((q) => !answers[q.id])
    if (unanswered.length > 0) {
      setError(`Please answer all questions (${unanswered.length} unanswered)`)
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const response = await fetch(`/api/student/courses/${courseId}/exam/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit exam')
      }

      const data = await response.json()
      setResult(data.data)

      if (onComplete) {
        onComplete({
          score: data.data.score,
          isPassed: data.data.isPassed,
          certificateCode: data.data.certificateCode,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error submitting exam')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading exam...</div>
  }

  if (!exam) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
        {error || 'No exam available for this course'}
      </div>
    )
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div
          className={`rounded-lg p-8 text-center ${
            result.isPassed
              ? 'bg-green-50 border-2 border-green-200'
              : 'bg-orange-50 border-2 border-orange-200'
          }`}
        >
          <div
            className={`text-6xl mb-4 ${result.isPassed ? 'text-green-600' : 'text-orange-600'}`}
          >
            {result.isPassed ? '🎓' : '📊'}
          </div>

          <h2
            className={`text-3xl font-bold mb-2 ${
              result.isPassed ? 'text-green-900' : 'text-orange-900'
            }`}
          >
            {result.message}
          </h2>

          <div className="space-y-3 text-gray-700 mb-8">
            <p className="text-4xl font-bold">{Math.round(result.score)}%</p>
            <p className="text-lg">
              Your passing score is {exam.passingScore}%
            </p>
            <p className="text-sm">
              Automatically graded questions: {result.correctCount} / {result.totalAutoGradedQuestions} correct
            </p>
          </div>

          {result.isPassed && result.certificateCode && (
            <div className="bg-white rounded-lg p-6 mb-6">
              <p className="text-gray-600 mb-2">Certificate Code:</p>
              <p className="text-2xl font-mono font-bold text-ap-copper">
                {result.certificateCode}
              </p>
              <p className="text-xs text-gray-500 mt-2">Save this code for your records</p>
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={() => window.history.back()}
              className="w-full px-4 py-3 bg-ap-copper text-white rounded font-medium hover:bg-orange-700 transition"
            >
              Return to Course
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border-b-2 border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gray-900">{exam.title}</h1>
        <p className="text-gray-600 mt-2">Course: {courseTitle}</p>
        <p className="text-sm text-gray-500 mt-1">
          {questions.length} questions • Passing score: {exam.passingScore}% • Answer all to submit
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded">
        <p className="text-sm">
          ℹ️ Multiple choice questions will be automatically graded. Written responses and file uploads
          require manual review.
        </p>
      </div>

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

      {/* Submit section */}
      <div className="bg-white border-t-2 border-gray-200 pt-6">
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-6 py-4 bg-ap-copper text-white rounded-lg font-bold text-lg hover:bg-orange-700 disabled:opacity-50 transition"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Final Exam'}
          </button>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>
      </div>
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

function QuestionCard({
  index,
  question,
  answer,
  onAnswerChange,
}: QuestionCardProps) {
  return (
    <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
      <div className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {index + 1}. {question.title}
          </h3>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 whitespace-nowrap">
            {question.type.replace('_', ' ')}
          </span>
        </div>
        {question.description && (
          <p className="text-gray-600 text-sm mt-2">{question.description}</p>
        )}
      </div>

      {/* Question input based on type */}
      <div className="mt-4">
        {question.type === 'MULTIPLE_CHOICE' && (
          <div className="space-y-2">
            {(question.config.options || []).map((option: string) => (
              <label key={option} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  value={option}
                  checked={answer === option}
                  onChange={(e) => onAnswerChange(e.target.value)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-gray-700 group-hover:text-gray-900">{option}</span>
              </label>
            ))}
          </div>
        )}

        {question.type === 'SHORT_ANSWER' && (
          <input
            type="text"
            value={answer || ''}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Enter your answer"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ap-copper"
          />
        )}

        {question.type === 'WRITTEN' && (
          <textarea
            value={answer || ''}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Write your response here..."
            rows={5}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ap-copper"
          />
        )}

        {question.type === 'FILE_UPLOAD' && (
          <div>
            <input
              type="file"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0]
                if (file) {
                  onAnswerChange({
                    fileName: file.name,
                    fileSize: file.size,
                  })
                }
              }}
              className="block w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg"
              accept={question.config.allowedMimeTypes?.join(',') || '*'}
            />
            {answer && (
              <p className="text-sm text-green-600 mt-2">
                ✓ {answer.fileName} ({(answer.fileSize / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'

export type QuestionType = 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'FILE_UPLOAD' | 'WRITTEN'

interface Question {
  id: string
  type: QuestionType
  title: string
  description?: string
  order: number
  config: Record<string, any>
}

interface FormBuilderProps {
  testId: string
  moduleId: string
  initialQuestions?: Question[]
  onQuestionsChange?: (questions: Question[]) => void
}

const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  {
    value: 'MULTIPLE_CHOICE',
    label: 'Multiple Choice',
    description: 'Choose one correct answer from options',
  },
  {
    value: 'SHORT_ANSWER',
    label: 'Short Answer',
    description: 'Brief text response',
  },
  {
    value: 'FILE_UPLOAD',
    label: 'File Upload',
    description: 'Students upload files (images, documents)',
  },
  {
    value: 'WRITTEN',
    label: 'Written Response',
    description: 'Long-form text answer',
  },
]

export default function FormBuilder({
  testId,
  moduleId,
  initialQuestions = [],
  onQuestionsChange,
}: FormBuilderProps) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Fetch questions on mount
  useEffect(() => {
    if (!initialQuestions.length) {
      fetchQuestions()
    } else {
      setIsLoading(false)
    }
  }, [testId])

  const fetchQuestions = async () => {
    try {
      const response = await fetch(
        `/api/admin/modules/${moduleId}/tests/${testId}/questions`
      )
      if (!response.ok) throw new Error('Failed to load questions')
      const data = await response.json()
      setQuestions(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading questions')
    } finally {
      setIsLoading(false)
    }
  }

  const addQuestion = async (type: QuestionType) => {
    try {
      const response = await fetch(
        `/api/admin/modules/${moduleId}/tests/${testId}/questions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            title: `New ${QUESTION_TYPES.find((qt) => qt.value === type)?.label} Question`,
            config: getDefaultConfig(type),
          }),
        }
      )

      if (!response.ok) throw new Error('Failed to create question')
      const data = await response.json()

      const newQuestion = data.data
      setQuestions([...questions, newQuestion])
      setEditingId(newQuestion.id)
      onQuestionsChange?.([...questions, newQuestion])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding question')
    }
  }

  const updateQuestion = async (id: string, updates: Partial<Question>) => {
    try {
      setIsSaving(true)
      const response = await fetch(
        `/api/admin/modules/${moduleId}/tests/${testId}/questions/${id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      )

      if (!response.ok) throw new Error('Failed to update question')
      const data = await response.json()

      const updated = questions.map((q) => (q.id === id ? data.data : q))
      setQuestions(updated)
      onQuestionsChange?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating question')
    } finally {
      setIsSaving(false)
    }
  }

  const deleteQuestion = async (id: string) => {
    if (!confirm('Delete this question?')) return

    try {
      const response = await fetch(
        `/api/admin/modules/${moduleId}/tests/${testId}/questions/${id}`,
        { method: 'DELETE' }
      )

      if (!response.ok) throw new Error('Failed to delete question')

      const updated = questions.filter((q) => q.id !== id)
      setQuestions(updated)
      onQuestionsChange?.(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting question')
    }
  }

  const handleDragStart = (id: string) => setDraggedId(id)

  const handleDrop = async (targetIndex: number) => {
    if (!draggedId) return

    const draggedIndex = questions.findIndex((q) => q.id === draggedId)
    if (draggedIndex === targetIndex || draggedIndex === -1) return

    const newQuestions = [...questions]
    const [moved] = newQuestions.splice(draggedIndex, 1)
    newQuestions.splice(targetIndex, 0, moved)

    setQuestions(newQuestions)
    setDraggedId(null)
    setDragOverIndex(null)

    // Update order in database
    for (let i = 0; i < newQuestions.length; i++) {
      if (newQuestions[i].order !== i) {
        await updateQuestion(newQuestions[i].id, { order: i })
      }
    }
  }

  const getDefaultConfig = (type: QuestionType): Record<string, any> => {
    switch (type) {
      case 'MULTIPLE_CHOICE':
        return { options: ['Option 1', 'Option 2'], correctAnswer: 'Option 1' }
      case 'FILE_UPLOAD':
        return { allowedMimeTypes: ['image/*', 'application/pdf'], maxFileSize: 10 * 1024 * 1024 }
      default:
        return {}
    }
  }

  if (isLoading) {
    return <div className="text-center py-8 text-gray-600">Loading form...</div>
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Add Question Buttons */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Add New Question</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {QUESTION_TYPES.map((qt) => (
            <button
              key={qt.value}
              onClick={() => addQuestion(qt.value)}
              disabled={isSaving}
              className="text-left px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <p className="font-medium text-sm text-gray-900">{qt.label}</p>
              <p className="text-xs text-gray-500">{qt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Questions List */}
      {questions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No questions yet. Add one above.</div>
      ) : (
        <div className="space-y-3">
          {questions.map((question, index) => (
            <QuestionEditor
              key={question.id}
              question={question}
              index={index}
              isDragged={draggedId === question.id}
              isDragOver={dragOverIndex === index}
              onTitleChange={(title) => updateQuestion(question.id, { title })}
              onConfigChange={(config) => updateQuestion(question.id, { config })}
              onDelete={() => deleteQuestion(question.id)}
              onDragStart={() => handleDragStart(question.id)}
              onDragOver={() => setDragOverIndex(index)}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={() => handleDrop(index)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Question Editor Component
interface QuestionEditorProps {
  question: Question
  index: number
  isDragged: boolean
  isDragOver: boolean
  onTitleChange: (title: string) => void
  onConfigChange: (config: Record<string, any>) => void
  onDelete: () => void
  onDragStart: () => void
  onDragOver: () => void
  onDragLeave: () => void
  onDrop: () => void
}

function QuestionEditor({
  question,
  index,
  isDragged,
  isDragOver,
  onTitleChange,
  onConfigChange,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: QuestionEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver()
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
      }}
      className={`border-2 rounded-lg p-4 transition-colors ${
        isDragged
          ? 'border-ap-copper bg-orange-100 opacity-50'
          : isDragOver
          ? 'border-ap-copper bg-orange-50'
          : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Drag handle */}
        <div className="text-gray-400 cursor-move">⋮⋮</div>

        {/* Question info */}
        <div className="flex-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full text-left"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{index + 1}.</span>
              <input
                type="text"
                value={question.title}
                onChange={(e) => onTitleChange(e.target.value)}
                className="flex-1 font-medium text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-ap-copper focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                {question.type}
              </span>
            </div>
          </button>
        </div>

        {/* Delete button */}
        <button
          onClick={onDelete}
          className="text-red-600 hover:text-red-800 font-medium"
        >
          Delete
        </button>
      </div>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          <QuestionConfigEditor
            type={question.type}
            config={question.config}
            onConfigChange={onConfigChange}
          />
        </div>
      )}
    </div>
  )
}

// Question Config Editor
interface QuestionConfigEditorProps {
  type: QuestionType
  config: Record<string, any>
  onConfigChange: (config: Record<string, any>) => void
}

function QuestionConfigEditor({
  type,
  config,
  onConfigChange,
}: QuestionConfigEditorProps) {
  switch (type) {
    case 'MULTIPLE_CHOICE':
      return (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Options</label>
          <div className="space-y-2">
            {(config.options || []).map((option: string, idx: number) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...(config.options || [])]
                    newOptions[idx] = e.target.value
                    onConfigChange({ ...config, options: newOptions })
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded"
                  placeholder={`Option ${idx + 1}`}
                />
                <button
                  onClick={() => {
                    const newOptions = (config.options || []).filter(
                      (_: string, i: number) => i !== idx
                    )
                    onConfigChange({ ...config, options: newOptions })
                  }}
                  className="text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const newOptions = [...(config.options || []), `Option ${(config.options || []).length + 1}`]
              onConfigChange({ ...config, options: newOptions })
            }}
            className="text-sm text-ap-copper hover:text-orange-700"
          >
            + Add Option
          </button>

          <label className="block text-sm font-medium text-gray-700 mt-4">
            Correct Answer
          </label>
          <select
            value={config.correctAnswer || ''}
            onChange={(e) => onConfigChange({ ...config, correctAnswer: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded"
          >
            <option value="">Select correct answer</option>
            {(config.options || []).map((option: string) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )

    case 'FILE_UPLOAD':
      return (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Allowed File Types</label>
          <input
            type="text"
            value={(config.allowedMimeTypes || []).join(', ')}
            onChange={(e) =>
              onConfigChange({
                ...config,
                allowedMimeTypes: e.target.value.split(',').map((s) => s.trim()),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded"
            placeholder="image/*, application/pdf, application/msword, etc"
          />
          <p className="text-xs text-gray-500">Comma-separated MIME types</p>

          <label className="block text-sm font-medium text-gray-700 mt-4">
            Max File Size (MB)
          </label>
          <input
            type="number"
            value={(config.maxFileSize || 0) / (1024 * 1024)}
            onChange={(e) =>
              onConfigChange({
                ...config,
                maxFileSize: parseInt(e.target.value) * 1024 * 1024,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded"
          />
        </div>
      )

    default:
      return <p className="text-sm text-gray-500">No additional configuration needed</p>
  }
}

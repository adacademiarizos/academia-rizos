'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import FileUploadProgress, { type UploadedFile } from '@/app/components/FileUploadProgress'

type Scope = 'COURSE' | 'MODULE' | 'STYLE' | 'LESSON'
type Resource = { id: string; title: string; fileUrl: string; fileType: string; fileSize: number }
type QuestionType = 'MULTIPLE_CHOICE' | 'WRITTEN' | 'PHOTO' | 'VIDEO'
type DraftQuestion = { type: QuestionType; title: string; options: string[]; correctAnswer: string }
type Assessment = { id: string; title: string; isRequired: boolean; isFinalExam: boolean; maxAttempts: number; questions: unknown[] }

const EMPTY_QUESTION: DraftQuestion = {
  type: 'MULTIPLE_CHOICE',
  title: '',
  options: ['', ''],
  correctAnswer: '',
}

const fieldClassName = 'w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-ap-copper focus:outline-none'

function newQuestion(): DraftQuestion {
  return { ...EMPTY_QUESTION, options: ['', ''] }
}

function LearningContentModal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string
  description: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="learning-content-modal-title"
    >
      <div className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-white/15 bg-[#262720] shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h5 id="learning-content-modal-title" className="text-lg font-semibold text-white">{title}</h5>
            <p className="mt-1 text-sm text-white/50">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xl leading-none text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Cerrar formulario"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function LearningContentManager({ scope, scopeId, courseId }: { scope: Scope; scopeId: string; courseId: string }) {
  const prefix = `/api/admin/learning/${scope}/${scopeId}`
  const [resources, setResources] = useState<Resource[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [pendingFile, setPendingFile] = useState<UploadedFile | null>(null)
  const [resourceTitle, setResourceTitle] = useState('')
  const [resourceModalOpen, setResourceModalOpen] = useState(false)
  const [assessmentModalOpen, setAssessmentModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [required, setRequired] = useState(false)
  const [finalExam, setFinalExam] = useState(false)
  const [maxAttempts, setMaxAttempts] = useState(1)
  const [passingScore, setPassingScore] = useState(70)
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion()])

  const scopeLabel = useMemo(() => ({ COURSE: 'curso', MODULE: 'módulo', STYLE: 'estilo', LESSON: 'lección' }[scope]), [scope])

  const load = useCallback(async () => {
    const [resourceResponse, assessmentResponse] = await Promise.all([
      fetch(`${prefix}/resources`),
      fetch(`${prefix}/assessments`),
    ])

    if (resourceResponse.ok) setResources((await resourceResponse.json()).data ?? [])
    if (assessmentResponse.ok) setAssessments((await assessmentResponse.json()).data ?? [])
  }, [prefix])

  useEffect(() => { void load() }, [load])

  const resetResourceDraft = () => {
    setPendingFile(null)
    setResourceTitle('')
  }

  const resetAssessmentDraft = () => {
    setTitle('')
    setDescription('')
    setRequired(false)
    setFinalExam(false)
    setMaxAttempts(1)
    setPassingScore(70)
    setQuestions([newQuestion()])
  }

  const closeResourceModal = () => {
    if (saving) return
    resetResourceDraft()
    setResourceModalOpen(false)
  }

  const closeAssessmentModal = () => {
    if (saving) return
    resetAssessmentDraft()
    setAssessmentModalOpen(false)
  }

  const openResourceModal = () => {
    setMessage(null)
    resetResourceDraft()
    setAssessmentModalOpen(false)
    setResourceModalOpen(true)
  }

  const openAssessmentModal = () => {
    setMessage(null)
    resetAssessmentDraft()
    setResourceModalOpen(false)
    setAssessmentModalOpen(true)
  }

  const createResource = async () => {
    if (!pendingFile) {
      setMessage('Primero sube un archivo para crear el recurso.')
      return
    }

    if (!resourceTitle.trim()) {
      setMessage('Indica un título para el recurso.')
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`${prefix}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: resourceTitle.trim(),
          fileUrl: pendingFile.fileUrl,
          fileType: pendingFile.fileType,
          fileSize: pendingFile.fileSize,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'No se pudo guardar el recurso.')

      resetResourceDraft()
      setResourceModalOpen(false)
      setMessage('Recurso añadido.')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar el recurso.')
    } finally {
      setSaving(false)
    }
  }

  const createAssessment = async () => {
    if (!title.trim()) {
      setMessage('Indica un título para la evaluación.')
      return
    }

    if (questions.length === 0) {
      setMessage('La evaluación debe contener al menos una pregunta.')
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        isRequired: required || finalExam,
        isFinalExam: finalExam,
        maxAttempts,
        passingScore,
        questions: questions.map((question, index) => ({
          type: question.type,
          title: question.title,
          order: index,
          ...(question.type === 'MULTIPLE_CHOICE'
            ? { options: question.options.filter(Boolean), correctAnswer: question.correctAnswer }
            : {}),
        })),
      }
      const response = await fetch(`${prefix}/assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'No se pudo crear la evaluación.')

      resetAssessmentDraft()
      setAssessmentModalOpen(false)
      setMessage('Evaluación creada.')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear la evaluación.')
    } finally {
      setSaving(false)
    }
  }

  const removeResource = async (id: string) => {
    if (!confirm('¿Eliminar este recurso?')) return
    await fetch(`/api/admin/learning/resources/${id}`, { method: 'DELETE' })
    await load()
  }

  const removeAssessment = async (id: string) => {
    if (!confirm('¿Eliminar esta evaluación y sus intentos?')) return
    await fetch(`/api/admin/assessments/${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <section className="space-y-3 border-t border-white/10 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium text-white/80">Contenido de {scopeLabel}</h4>
          <p className="text-xs text-white/40">Recursos y evaluaciones exclusivos de este contexto.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openResourceModal}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/15"
          >
            + Recurso
          </button>
          <button
            type="button"
            onClick={openAssessmentModal}
            className="rounded-lg bg-ap-copper px-3 py-1.5 text-xs text-white transition hover:bg-orange-700"
          >
            + Evaluación
          </button>
        </div>
      </div>

      {message && <p className="text-xs text-ap-copper" role="status">{message}</p>}

      {resources.length > 0 && (
        <ul className="space-y-1">
          {resources.map((resource) => (
            <li key={resource.id} className="flex items-center justify-between gap-2 text-xs text-white/70">
              <a href={resource.fileUrl} target="_blank" rel="noreferrer" className="truncate hover:text-ap-copper">
                📎 {resource.title}
              </a>
              <button type="button" onClick={() => void removeResource(resource.id)} className="text-red-400 hover:text-red-300">
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}

      {assessments.length > 0 && (
        <ul className="space-y-1">
          {assessments.map((assessment) => (
            <li key={assessment.id} className="flex items-center justify-between gap-2 text-xs text-white/65">
              <span>
                {assessment.title} · {assessment.questions.length} preguntas · {assessment.maxAttempts} intento(s)
                {assessment.isRequired ? ' · obligatoria' : ''}
                {assessment.isFinalExam ? ' · final' : ''}
              </span>
              <button type="button" onClick={() => void removeAssessment(assessment.id)} className="text-red-400 hover:text-red-300">
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}

      {resourceModalOpen && (
        <LearningContentModal
          title={`Añadir recurso al ${scopeLabel}`}
          description="Sube el archivo y completa el nombre con el que lo verán los participantes."
          onClose={closeResourceModal}
        >
          <div className="space-y-4">
            {pendingFile ? (
              <>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/75">
                  <p className="font-medium text-white">Archivo listo para añadir</p>
                  <p className="mt-1 break-all text-xs text-white/50">{pendingFile.fileName}</p>
                </div>
                <label className="block text-sm text-white/75">
                  Título del recurso
                  <input
                    value={resourceTitle}
                    onChange={(event) => setResourceTitle(event.target.value)}
                    placeholder="Ej.: Guía de prácticas"
                    className={`${fieldClassName} mt-1`}
                    autoFocus
                  />
                </label>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={resetResourceDraft}
                    disabled={saving}
                    className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white/75 transition hover:bg-white/15 disabled:opacity-50"
                  >
                    Quitar archivo
                  </button>
                  <button
                    type="button"
                    onClick={() => void createResource()}
                    disabled={saving}
                    className="rounded-lg bg-ap-copper px-3 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:opacity-50"
                  >
                    {saving ? 'Guardando…' : 'Añadir recurso'}
                  </button>
                </div>
              </>
            ) : (
              <FileUploadProgress
                uploadType="resource"
                courseId={courseId}
                deferPersistence
                onUploadComplete={(file) => {
                  setPendingFile(file)
                  setResourceTitle(file.fileName)
                  setMessage(null)
                }}
              />
            )}
            {message && <p className="text-xs text-ap-copper" role="status">{message}</p>}
            <div className="flex justify-end border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={closeResourceModal}
                disabled={saving}
                className="rounded-lg px-3 py-2 text-sm text-white/65 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                Cancelar y descartar
              </button>
            </div>
          </div>
        </LearningContentModal>
      )}

      {assessmentModalOpen && (
        <LearningContentModal
          title={`Crear evaluación para el ${scopeLabel}`}
          description="Configura los intentos, la nota mínima y las preguntas antes de publicarla."
          onClose={closeAssessmentModal}
          wide
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void createAssessment()
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-white/75 sm:col-span-2">
                Título de la evaluación
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ej.: Diagnóstico de técnica"
                  className={`${fieldClassName} mt-1`}
                  required
                  autoFocus
                />
              </label>
              <label className="block text-sm text-white/75 sm:col-span-2">
                Instrucciones <span className="text-white/40">(opcional)</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Indica cómo deben responder los participantes."
                  rows={3}
                  className={`${fieldClassName} mt-1 resize-y`}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-white/75">
                <input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} />
                Obligatoria
              </label>
              {scope === 'COURSE' && (
                <label className="flex items-center gap-2 text-sm text-white/75">
                  <input
                    type="checkbox"
                    checked={finalExam}
                    onChange={(event) => {
                      setFinalExam(event.target.checked)
                      if (event.target.checked) setRequired(true)
                    }}
                  />
                  Examen final certificable
                </label>
              )}
              <label className="block text-sm text-white/75">
                Intentos permitidos
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxAttempts}
                  onChange={(event) => setMaxAttempts(Number(event.target.value))}
                  className={`${fieldClassName} mt-1`}
                />
              </label>
              <label className="block text-sm text-white/75">
                Nota mínima
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={passingScore}
                  onChange={(event) => setPassingScore(Number(event.target.value))}
                  className={`${fieldClassName} mt-1`}
                />
              </label>
            </div>

            <div className="space-y-3 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between gap-3">
                <h6 className="text-sm font-medium text-white">Preguntas</h6>
                <button
                  type="button"
                  onClick={() => setQuestions((current) => [...current, newQuestion()])}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/15"
                >
                  + Pregunta
                </button>
              </div>

              {questions.map((question, questionIndex) => (
                <div key={questionIndex} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={question.type}
                      onChange={(event) => setQuestions((current) => current.map((item, index) => (
                        index === questionIndex
                          ? {
                            ...item,
                            type: event.target.value as QuestionType,
                            options: event.target.value === 'MULTIPLE_CHOICE' ? (item.options.length ? item.options : ['', '']) : [],
                            correctAnswer: '',
                          }
                          : item
                      )))}
                      className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-xs text-white"
                    >
                      <option value="MULTIPLE_CHOICE">Selección múltiple</option>
                      <option value="WRITTEN">Escrita</option>
                      <option value="PHOTO">Foto</option>
                      <option value="VIDEO">Video</option>
                    </select>
                    <input
                      value={question.title}
                      onChange={(event) => setQuestions((current) => current.map((item, index) => (
                        index === questionIndex ? { ...item, title: event.target.value } : item
                      )))}
                      placeholder="Escribe la pregunta"
                      className="min-w-[12rem] flex-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-xs text-white placeholder:text-white/35"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setQuestions((current) => current.filter((_, index) => index !== questionIndex))}
                      disabled={questions.length === 1}
                      title={questions.length === 1 ? 'La evaluación necesita al menos una pregunta.' : 'Eliminar pregunta'}
                      className="rounded-lg px-2 py-1 text-sm text-red-400 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Eliminar pregunta"
                    >
                      ×
                    </button>
                  </div>

                  {question.type === 'MULTIPLE_CHOICE' && (
                    <div className="space-y-2">
                      {question.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <input
                            value={option}
                            onChange={(event) => setQuestions((current) => current.map((item, index) => (
                              index === questionIndex
                                ? { ...item, options: item.options.map((optionValue, i) => i === optionIndex ? event.target.value : optionValue) }
                                : item
                            )))}
                            placeholder={`Opción ${optionIndex + 1}`}
                            className="flex-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-xs text-white placeholder:text-white/35"
                            required
                          />
                          <label className="flex items-center gap-1 text-xs text-white/60">
                            <input
                              type="radio"
                              name={`correct-${questionIndex}`}
                              checked={question.correctAnswer === option && Boolean(option)}
                              onChange={() => setQuestions((current) => current.map((item, index) => (
                                index === questionIndex ? { ...item, correctAnswer: option } : item
                              )))}
                              required={optionIndex === 0}
                            />
                            Correcta
                          </label>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setQuestions((current) => current.map((item, index) => (
                          index === questionIndex ? { ...item, options: [...item.options, ''] } : item
                        )))}
                        className="text-xs text-ap-copper transition hover:text-orange-300"
                      >
                        + Añadir opción
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {message && <p className="text-xs text-ap-copper" role="status">{message}</p>}
            <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={closeAssessmentModal}
                disabled={saving}
                className="rounded-lg px-3 py-2 text-sm text-white/65 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                Cancelar y descartar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-ap-copper px-3 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:opacity-50"
              >
                {saving ? 'Guardando…' : 'Guardar evaluación'}
              </button>
            </div>
          </form>
        </LearningContentModal>
      )}
    </section>
  )
}

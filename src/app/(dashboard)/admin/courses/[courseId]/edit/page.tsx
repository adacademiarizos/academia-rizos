'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import FileUploadProgress from '@/app/components/FileUploadProgress'

interface Course {
  id: string
  title: string
  description: string | null
  priceCents: number
  rentalDays: number | null
  isActive: boolean
}

interface Module {
  id: string
  title: string
  order: number
  description: string | null
  videoUrl: string | null
  transcript: string | null
}

interface TestQuestion {
  id: string
  title: string
  order: number
  config: Record<string, any>
}

interface ModuleTest {
  id: string
  title: string
  description: string | null
  isRequired: boolean
  maxAttempts: number
  passingScore: number
  questionCount?: number
  questions?: TestQuestion[]
}

interface CourseTest {
  id: string
  title: string
  description: string | null
  order: number
  isRequired: boolean
  isFinalExam: boolean
  maxAttempts: number
  passingScore: number
  _count?: { questions: number; submissions: number }
}

interface UploadedResource {
  title: string
  fileUrl: string
  fileType: string
  fileSize: number
}

interface Lesson {
  id: string
  order: number
  title: string
  description: string | null
  videoUrl: string | null
  videoFileUrl: string | null
  transcript: string | null
}

export default function CourseEditPage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string

  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showModuleForm, setShowModuleForm] = useState(false)
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Test management state
  const [moduleTests, setModuleTests] = useState<Record<string, ModuleTest[]>>({})
  const [showTestForm, setShowTestForm] = useState(false)
  const [testForm, setTestForm] = useState({ title: '', maxAttempts: 1, passingScore: 70, isRequired: false })
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null)
  const [questionForms, setQuestionForms] = useState<Record<string, { title: string; options: string[]; correctIndex: number }>>({})
  const [testQuestions, setTestQuestions] = useState<Record<string, TestQuestion[]>>({})

  // Course-level tests state
  const [courseTests, setCourseTests] = useState<CourseTest[]>([])
  const [showCourseTestForm, setShowCourseTestForm] = useState(false)
  const [courseTestForm, setCourseTestForm] = useState({
    title: '',
    description: '',
    isRequired: false,
    isFinalExam: false,
    maxAttempts: 1,
    passingScore: 70,
  })
  const [expandedCourseTestId, setExpandedCourseTestId] = useState<string | null>(null)
  const [courseTestQuestions, setCourseTestQuestions] = useState<Record<string, TestQuestion[]>>({})
  const [courseTestQuestionForms, setCourseTestQuestionForms] = useState<Record<string, {
    type: 'MULTIPLE_CHOICE' | 'WRITTEN' | 'FILE_UPLOAD'
    title: string
    options: string[]
    correctIndex: number
  }>>({})

  // Module resources state
  const [moduleResources, setModuleResources] = useState<Record<string, UploadedResource[]>>({})
  const [newModuleResources, setNewModuleResources] = useState<UploadedResource[]>([])
  // Module lessons state
  const [moduleLessons, setModuleLessons] = useState<Record<string, Lesson[]>>({})
  const [showLessonForms, setShowLessonForms] = useState<Record<string, boolean>>({})
  const [lessonForm, setLessonForm] = useState({ title: '', description: '', videoUrl: '' })
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null)
  const [editLessonForms, setEditLessonForms] = useState<Record<string, { title: string; description: string; videoUrl: string; transcript: string }>>({})
  const [showVideoUploadLessonNew, setShowVideoUploadLessonNew] = useState(false)
  const [showVideoUploadLessonEdit, setShowVideoUploadLessonEdit] = useState<Record<string, boolean>>({})
  const [transcribing, setTranscribing] = useState<Record<string, boolean>>({})
  const [generatingSynopsis, setGeneratingSynopsis] = useState<Record<string, boolean>>({})

  const [courseForm, setCourseForm] = useState<Partial<Course>>({})
  const [moduleForm, setModuleForm] = useState({
    title: '',
    description: '',
  })
  const [editModuleForm, setEditModuleForm] = useState({
    order: 1,
    title: '',
    description: '',
    transcript: '',
  })

  // Fee settings for price preview
  const [feeSettings, setFeeSettings] = useState({ feePercent: 2.5, feeFixedCents: 25 })

  useEffect(() => {
    fetchCourse()
    fetchModules()
    fetchCourseTests()
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => { if (d.success) setFeeSettings({ feePercent: d.data.feePercent, feeFixedCents: d.data.feeFixedCents }) })
      .catch(() => {})
  }, [courseId])

  const fetchCourse = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/admin/courses?limit=100`)
      if (response.ok) {
        const data = await response.json()
        const foundCourse = data.data.find((c: Course) => c.id === courseId)
        if (foundCourse) {
          setCourse(foundCourse)
          setCourseForm(foundCourse)
        } else {
          setError('Curso no encontrado')
        }
      } else {
        setError('Error loading course')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error loading course')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchModules = async () => {
    try {
      const response = await fetch(`/api/admin/courses/${courseId}/modules`)
      if (response.ok) {
        const data = await response.json()
        setModules(data.data || [])
      } else {
        console.error('Error loading modules')
      }
    } catch (err) {
      console.error('Error fetching modules:', err)
    }
  }

  const handleSaveCourse = async () => {
    try {
      setIsSaving(true)
      setError(null)

      const updates: Partial<Course> = {}
      if (courseForm.title !== course?.title) updates.title = courseForm.title
      if (courseForm.description !== course?.description)
        updates.description = courseForm.description
      if (courseForm.priceCents !== course?.priceCents)
        updates.priceCents = courseForm.priceCents
      if (courseForm.rentalDays !== course?.rentalDays)
        updates.rentalDays = courseForm.rentalDays
      if (courseForm.isActive !== course?.isActive) updates.isActive = courseForm.isActive

      if (Object.keys(updates).length === 0) {
        alert('No changes to save')
        return
      }

      const response = await fetch(`/api/admin/courses/${courseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        alert('Curso actualizado exitosamente')
        fetchCourse()
      } else {
        const data = await response.json()
        setError(data.error || 'Error updating course')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error updating course')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddModule = async () => {
    try {
      if (!moduleForm.title.trim()) {
        alert('Título del módulo es requerido')
        return
      }

      setError(null)

      const nextOrder = modules.length > 0 ? Math.max(...modules.map((m) => m.order)) + 1 : 1

      const response = await fetch(`/api/admin/courses/${courseId}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: nextOrder,
          title: moduleForm.title,
          description: moduleForm.description || undefined,
          resources: newModuleResources.length > 0 ? newModuleResources : undefined,
        }),
      })

      const responseData = await response.json()

      if (response.ok) {
        alert('Módulo creado exitosamente')
        setModuleForm({ title: '', description: '' })
        setNewModuleResources([])
        setShowModuleForm(false)
        fetchModules()
      } else {
        if (responseData.details && Array.isArray(responseData.details)) {
          const errorMessages = responseData.details
            .map((detail: any) => `${detail.path.join('.')}: ${detail.message}`)
            .join('\n')
          setError(`Error de validación:\n${errorMessages}`)
        } else {
          setError(responseData.error || 'Error creating module')
        }
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error creating module')
    }
  }

  const handleDeleteModule = async (moduleId: string, moduleTitle: string) => {
    if (!confirm(`¿Estás seguro de eliminar el módulo "${moduleTitle}"?`)) return

    try {
      const response = await fetch(
        `/api/admin/courses/${courseId}/modules/${moduleId}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        alert('Módulo eliminado')
        fetchModules()
      } else {
        setError('Error deleting module')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error deleting module')
    }
  }

  const handleEditModule = (module: Module) => {
    setEditingModuleId(module.id)
    setEditModuleForm({
      order: module.order,
      title: module.title,
      description: module.description || '',
      videoUrl: module.videoUrl || '',
      transcript: module.transcript || '',
    })
    setShowTestForm(false)
    setExpandedTestId(null)
    fetchModuleTests(module.id)
    fetchModuleResources(module.id)
    fetchModuleLessons(module.id)
  }

  const handleSaveModuleChanges = async () => {
    try {
      if (!editingModuleId || !editModuleForm.title.trim()) {
        alert('Título del módulo es requerido')
        return
      }

      setError(null)

      const response = await fetch(
        `/api/admin/courses/${courseId}/modules/${editingModuleId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order: editModuleForm.order,
            title: editModuleForm.title,
            description: editModuleForm.description || undefined,
            transcript: editModuleForm.transcript || undefined,
          }),
        }
      )

      const responseData = await response.json()

      if (response.ok) {
        alert('Módulo actualizado exitosamente')
        setEditingModuleId(null)
        fetchModules()
      } else {
        if (responseData.details && Array.isArray(responseData.details)) {
          const errorMessages = responseData.details
            .map((detail: any) => `${detail.path.join('.')}: ${detail.message}`)
            .join('\n')
          setError(`Error de validación:\n${errorMessages}`)
        } else {
          setError(responseData.error || 'Error updating module')
        }
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error updating module')
    }
  }

  const handleCancelEdit = () => {
    setEditingModuleId(null)
    setEditModuleForm({
      order: 1,
      title: '',
      description: '',
      transcript: '',
    })
  }

  // ── Test management functions ──────────────────────────────────────────────

  const fetchModuleTests = async (moduleId: string) => {
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}/tests`)
      if (res.ok) {
        const data = await res.json()
        setModuleTests((prev) => ({ ...prev, [moduleId]: data.data || [] }))
      }
    } catch (err) {
      console.error('Error fetching tests:', err)
    }
  }

  const fetchTestQuestions = async (moduleId: string, testId: string) => {
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}/tests/${testId}/questions`)
      if (res.ok) {
        const data = await res.json()
        setTestQuestions((prev) => ({ ...prev, [testId]: data.data || [] }))
      }
    } catch (err) {
      console.error('Error fetching questions:', err)
    }
  }

  const handleToggleTest = (moduleId: string, testId: string) => {
    if (expandedTestId === testId) {
      setExpandedTestId(null)
    } else {
      setExpandedTestId(testId)
      if (!testQuestions[testId]) {
        fetchTestQuestions(moduleId, testId)
      }
    }
  }

  const handleCreateTest = async (moduleId: string) => {
    if (!testForm.title.trim()) {
      alert('El título del test es requerido')
      return
    }
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testForm),
      })
      if (res.ok) {
        setTestForm({ title: '', maxAttempts: 1, passingScore: 70, isRequired: false })
        setShowTestForm(false)
        fetchModuleTests(moduleId)
      } else {
        const d = await res.json()
        alert(d.error || 'Error al crear el test')
      }
    } catch {
      alert('Error al crear el test')
    }
  }

  const handleDeleteTest = async (moduleId: string, testId: string) => {
    if (!confirm('¿Eliminar este test y todas sus preguntas?')) return
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}/tests/${testId}`, { method: 'DELETE' })
      if (res.ok) {
        if (expandedTestId === testId) setExpandedTestId(null)
        fetchModuleTests(moduleId)
      } else {
        alert('Error al eliminar el test')
      }
    } catch {
      alert('Error al eliminar el test')
    }
  }

  const handleAddQuestion = async (moduleId: string, testId: string) => {
    const form = questionForms[testId]
    if (!form || !form.title.trim()) {
      alert('El texto de la pregunta es requerido')
      return
    }
    const filledOptions = form.options.filter((o) => o.trim())
    if (filledOptions.length < 2) {
      alert('Ingresa al menos 2 opciones')
      return
    }
    const correctAnswer = form.options[form.correctIndex]
    if (!correctAnswer?.trim()) {
      alert('Selecciona una respuesta correcta válida')
      return
    }
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}/tests/${testId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'MULTIPLE_CHOICE',
          title: form.title,
          config: { options: filledOptions, correctAnswer },
        }),
      })
      if (res.ok) {
        setQuestionForms((prev) => ({ ...prev, [testId]: { title: '', options: ['', ''], correctIndex: 0 } }))
        fetchTestQuestions(moduleId, testId)
        fetchModuleTests(moduleId)
      } else {
        const d = await res.json()
        alert(d.error || 'Error al agregar la pregunta')
      }
    } catch {
      alert('Error al agregar la pregunta')
    }
  }

  const handleDeleteQuestion = async (moduleId: string, testId: string, questionId: string) => {
    if (!confirm('¿Eliminar esta pregunta?')) return
    try {
      const res = await fetch(
        `/api/admin/modules/${moduleId}/tests/${testId}/questions/${questionId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        fetchTestQuestions(moduleId, testId)
        fetchModuleTests(moduleId)
      } else {
        alert('Error al eliminar la pregunta')
      }
    } catch {
      alert('Error al eliminar la pregunta')
    }
  }

  // ── Course-level test functions ────────────────────────────────────────────

  const fetchCourseTests = async () => {
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/tests`)
      if (res.ok) {
        const data = await res.json()
        setCourseTests(data.data || [])
      }
    } catch (err) {
      console.error('Error fetching course tests:', err)
    }
  }

  const fetchCourseTestQuestions = async (testId: string) => {
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/tests/${testId}/questions`)
      if (res.ok) {
        const data = await res.json()
        setCourseTestQuestions((prev) => ({ ...prev, [testId]: data.data || [] }))
      }
    } catch (err) {
      console.error('Error fetching course test questions:', err)
    }
  }

  const handleToggleCourseTest = (testId: string) => {
    if (expandedCourseTestId === testId) {
      setExpandedCourseTestId(null)
    } else {
      setExpandedCourseTestId(testId)
      if (!courseTestQuestions[testId]) {
        fetchCourseTestQuestions(testId)
      }
    }
  }

  const handleCreateCourseTest = async () => {
    if (!courseTestForm.title.trim()) {
      alert('El título del test es requerido')
      return
    }
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courseTestForm),
      })
      if (res.ok) {
        setCourseTestForm({ title: '', description: '', isRequired: false, isFinalExam: false, maxAttempts: 1, passingScore: 70 })
        setShowCourseTestForm(false)
        fetchCourseTests()
      } else {
        const d = await res.json()
        alert(d.error || 'Error al crear el test')
      }
    } catch {
      alert('Error al crear el test')
    }
  }

  const handleDeleteCourseTest = async (testId: string) => {
    if (!confirm('¿Eliminar este test y todas sus preguntas?')) return
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/tests/${testId}`, { method: 'DELETE' })
      if (res.ok) {
        if (expandedCourseTestId === testId) setExpandedCourseTestId(null)
        fetchCourseTests()
      } else {
        alert('Error al eliminar el test')
      }
    } catch {
      alert('Error al eliminar el test')
    }
  }

  const handleAddCourseTestQuestion = async (testId: string) => {
    const form = courseTestQuestionForms[testId]
    if (!form || !form.title.trim()) {
      alert('El texto de la pregunta es requerido')
      return
    }

    let config: Record<string, any> = {}
    if (form.type === 'MULTIPLE_CHOICE') {
      const filledOptions = form.options.filter((o) => o.trim())
      if (filledOptions.length < 2) {
        alert('Ingresa al menos 2 opciones')
        return
      }
      const correctAnswer = form.options[form.correctIndex]
      if (!correctAnswer?.trim()) {
        alert('Selecciona una respuesta correcta válida')
        return
      }
      config = { options: filledOptions, correctAnswer }
    } else if (form.type === 'FILE_UPLOAD') {
      config = { acceptedTypes: ['image/*', 'video/*', 'application/pdf'] }
    }

    try {
      const res = await fetch(`/api/admin/courses/${courseId}/tests/${testId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: form.type, title: form.title, config }),
      })
      if (res.ok) {
        setCourseTestQuestionForms((prev) => ({ ...prev, [testId]: { type: 'MULTIPLE_CHOICE', title: '', options: ['', ''], correctIndex: 0 } }))
        fetchCourseTestQuestions(testId)
        fetchCourseTests()
      } else {
        const d = await res.json()
        alert(d.error || 'Error al agregar la pregunta')
      }
    } catch {
      alert('Error al agregar la pregunta')
    }
  }

  const handleDeleteCourseTestQuestion = async (testId: string, questionId: string) => {
    if (!confirm('¿Eliminar esta pregunta?')) return
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/tests/${testId}/questions/${questionId}`, { method: 'DELETE' })
      if (res.ok) {
        fetchCourseTestQuestions(testId)
        fetchCourseTests()
      } else {
        alert('Error al eliminar la pregunta')
      }
    } catch {
      alert('Error al eliminar la pregunta')
    }
  }

  // ── Module resources functions ─────────────────────────────────────────────

  const fetchModuleResources = async (moduleId: string) => {
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}/resources`)
      if (res.ok) {
        const data = await res.json()
        setModuleResources((prev) => ({ ...prev, [moduleId]: data.data || [] }))
      }
    } catch (err) {
      console.error('Error fetching module resources:', err)
    }
  }

  const handleDeleteModuleResource = async (moduleId: string, resourceId: string) => {
    if (!confirm('¿Eliminar este recurso?')) return
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}/resources/${resourceId}`, { method: 'DELETE' })
      if (res.ok) {
        fetchModuleResources(moduleId)
      } else {
        alert('Error al eliminar el recurso')
      }
    } catch {
      alert('Error al eliminar el recurso')
    }
  }

  // ── Module lessons functions ───────────────────────────────────────────────

  const fetchModuleLessons = async (moduleId: string) => {
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}/lessons`)
      if (res.ok) {
        const data = await res.json()
        setModuleLessons((prev) => ({ ...prev, [moduleId]: data.data || [] }))
      }
    } catch (err) {
      console.error('Error fetching lessons:', err)
    }
  }

  const handleCreateLesson = async (moduleId: string) => {
    if (!lessonForm.title.trim()) {
      alert('El título de la lección es requerido')
      return
    }
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: lessonForm.title,
          description: lessonForm.description || undefined,
          videoUrl: lessonForm.videoUrl || undefined,
        }),
      })
      if (res.ok) {
        setLessonForm({ title: '', description: '', videoUrl: '' })
        setShowVideoUploadLessonNew(false)
        setShowLessonForms((prev) => ({ ...prev, [moduleId]: false }))
        fetchModuleLessons(moduleId)
      } else {
        const d = await res.json()
        alert(d.error || 'Error al crear la lección')
      }
    } catch {
      alert('Error al crear la lección')
    }
  }

  const handleDeleteLesson = async (moduleId: string, lessonId: string) => {
    if (!confirm('¿Eliminar esta lección?')) return
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}/lessons/${lessonId}`, { method: 'DELETE' })
      if (res.ok) {
        if (expandedLessonId === lessonId) setExpandedLessonId(null)
        fetchModuleLessons(moduleId)
      } else {
        alert('Error al eliminar la lección')
      }
    } catch {
      alert('Error al eliminar la lección')
    }
  }

  const handleSaveLesson = async (moduleId: string, lessonId: string) => {
    const form = editLessonForms[lessonId]
    if (!form?.title?.trim()) {
      alert('El título es requerido')
      return
    }
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}/lessons/${lessonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          videoUrl: form.videoUrl || null,
          transcript: form.transcript || null,
        }),
      })
      if (res.ok) {
        setExpandedLessonId(null)
        fetchModuleLessons(moduleId)
      } else {
        alert('Error al guardar la lección')
      }
    } catch {
      alert('Error al guardar la lección')
    }
  }

  const handleTranscribe = async (type: 'module' | 'lesson', id: string) => {
    setTranscribing((prev) => ({ ...prev, [id]: true }))
    try {
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(type === 'module' ? { moduleId: id } : { lessonId: id }),
      })
      const data = await res.json()
      if (data.success) {
        if (type === 'module') {
          setEditModuleForm((prev) => ({ ...prev, transcript: data.data.transcript }))
        } else {
          setEditLessonForms((prev) => ({
            ...prev,
            [id]: { ...prev[id], transcript: data.data.transcript },
          }))
        }
      } else {
        alert('Error al transcribir: ' + (data.error || 'Error desconocido'))
      }
    } catch {
      alert('Error al transcribir el video')
    } finally {
      setTranscribing((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handleGenerateSynopsis = async (lessonId: string) => {
    setGeneratingSynopsis((prev) => ({ ...prev, [lessonId]: true }))
    try {
      const res = await fetch('/api/ai/synopsis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId }),
      })
      const data = await res.json()
      if (data.success) {
        setEditLessonForms((prev) => ({
          ...prev,
          [lessonId]: { ...prev[lessonId], description: data.data.synopsis },
        }))
      } else {
        alert('Error al generar sinopsis: ' + (data.error || 'Error desconocido'))
      }
    } catch {
      alert('Error al generar la sinopsis')
    } finally {
      setGeneratingSynopsis((prev) => ({ ...prev, [lessonId]: false }))
    }
  }

  // ──────────────────────────────────────────────────────────────────────────

  const handleDragStart = (moduleId: string) => {
    setDraggedModuleId(moduleId)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    setDragOverIndex(null)

    if (!draggedModuleId) return

    try {
      const sortedModules = [...modules].sort((a, b) => a.order - b.order)
      const draggedModule = sortedModules.find((m) => m.id === draggedModuleId)
      const draggedIndex = sortedModules.findIndex((m) => m.id === draggedModuleId)

      if (!draggedModule || draggedIndex === targetIndex) {
        setDraggedModuleId(null)
        return
      }

      const newModules = [...sortedModules]
      newModules.splice(draggedIndex, 1)
      newModules.splice(targetIndex, 0, draggedModule)

      const updatedModules = newModules.map((m, idx) => ({
        ...m,
        order: idx + 1,
      }))

      setModules(updatedModules)

      for (const mod of updatedModules) {
        if (mod.order !== modules.find((m) => m.id === mod.id)?.order) {
          await fetch(`/api/admin/courses/${courseId}/modules/${mod.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: mod.order }),
          })
        }
      }

      setDraggedModuleId(null)
      alert('Módulos reordenados exitosamente')
    } catch (err) {
      console.error('Error reordering modules:', err)
      setError('Error al reordenar módulos')
      fetchModules()
    }
  }

  if (isLoading) {
    return <div className="text-center py-12 text-white/60">Cargando...</div>
  }

  if (error && !course) {
    return <div className="text-center py-12 text-red-400">{error}</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Editar Curso</h1>
          <p className="text-white/60 mt-1 text-sm">Actualiza la información del curso</p>
        </div>
        <Link
          href="/admin/courses"
          className="text-white/60 hover:text-white text-sm transition"
        >
          ← Volver a cursos
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Course Form */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] p-8">
        <h2 className="text-xl font-semibold text-white mb-6">Información del Curso</h2>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Título
            </label>
            <input
              type="text"
              value={courseForm.title || ''}
              onChange={(e) =>
                setCourseForm({ ...courseForm, title: e.target.value })
              }
              className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-xl px-4 py-2.5 outline-none focus:border-ap-copper/50 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Descripción
            </label>
            <textarea
              value={courseForm.description || ''}
              onChange={(e) =>
                setCourseForm({ ...courseForm, description: e.target.value })
              }
              className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-xl px-4 py-2.5 outline-none focus:border-ap-copper/50 transition"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Precio (USD)
              </label>
              <input
                type="number"
                value={(courseForm.priceCents || 0) / 100}
                onChange={(e) =>
                  setCourseForm({
                    ...courseForm,
                    priceCents: Math.round(parseFloat(e.target.value) * 100),
                  })
                }
                className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-4 py-2.5 outline-none focus:border-ap-copper/50 transition"
                min="0"
                step="0.01"
              />
              {(courseForm.priceCents || 0) > 0 && (() => {
                const base = courseForm.priceCents || 0
                const fee = Math.round(base * (feeSettings.feePercent / 100) + feeSettings.feeFixedCents)
                const total = base + fee
                return (
                  <p className="text-xs text-white/40 mt-1.5">
                    El cliente paga: <span className="text-ap-copper font-medium">${(total / 100).toFixed(2)}</span>
                    {' '}(base ${(base / 100).toFixed(2)} + comisión Stripe ${(fee / 100).toFixed(2)})
                  </p>
                )
              })()}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Días de acceso (vacío = de por vida)
              </label>
              <input
                type="number"
                value={courseForm.rentalDays || ''}
                onChange={(e) =>
                  setCourseForm({
                    ...courseForm,
                    rentalDays: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-4 py-2.5 outline-none focus:border-ap-copper/50 transition"
                min="1"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={courseForm.isActive || false}
              onChange={(e) =>
                setCourseForm({ ...courseForm, isActive: e.target.checked })
              }
              className="rounded"
            />
            <label htmlFor="isActive" className="text-sm text-white/70">
              Curso activo
            </label>
          </div>

          <button
            onClick={handleSaveCourse}
            disabled={isSaving}
            className="bg-ap-copper hover:bg-orange-700 text-white px-6 py-2.5 rounded-xl font-medium disabled:opacity-50 transition"
          >
            {isSaving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Modules Section */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">Módulos</h2>
          <button
            onClick={() => setShowModuleForm(!showModuleForm)}
            className="bg-ap-copper hover:bg-orange-700 text-white px-4 py-2 rounded-xl font-medium transition text-sm"
          >
            {showModuleForm ? 'Cancelar' : '+ Nuevo Módulo'}
          </button>
        </div>

        {/* New Module Form */}
        {showModuleForm && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
            <h3 className="text-base font-semibold text-white mb-4">
              Agregar Nuevo Módulo
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={moduleForm.title}
                  onChange={(e) =>
                    setModuleForm({ ...moduleForm, title: e.target.value })
                  }
                  className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-xl px-3 py-2 outline-none focus:border-ap-copper/50 transition text-sm"
                  placeholder="Nombre del módulo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">
                  Descripción
                </label>
                <textarea
                  value={moduleForm.description}
                  onChange={(e) =>
                    setModuleForm({ ...moduleForm, description: e.target.value })
                  }
                  className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-xl px-3 py-2 outline-none focus:border-ap-copper/50 transition text-sm"
                  rows={2}
                />
              </div>

              {/* Recursos del módulo */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">
                  Recursos del módulo (PDF, imágenes, etc.)
                </label>
                {newModuleResources.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {newModuleResources.map((r, i) => (
                      <div key={i} className="flex items-center gap-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-white/70">
                        <span>📄 {r.title}</span>
                        <button
                          onClick={() => setNewModuleResources((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-red-400 hover:text-red-300 ml-1"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <FileUploadProgress
                  uploadType="resource"
                  moduleId="temp"
                  onUploadComplete={(file) => setNewModuleResources((prev) => [...prev, {
                    title: (file as any).fileName || 'Recurso',
                    fileUrl: file.fileUrl,
                    fileType: (file as any).fileType || 'other',
                    fileSize: (file as any).fileSize || 0,
                  }])}
                />
              </div>

              <button
                onClick={handleAddModule}
                className="w-full bg-ap-copper hover:bg-orange-700 text-white px-4 py-2 rounded-xl font-medium transition text-sm"
              >
                Crear Módulo
              </button>
            </div>
          </div>
        )}

        {/* Modules List */}
        {modules.length === 0 ? (
          <p className="text-white/50">No hay módulos. Crea uno para empezar.</p>
        ) : (
          <>
            <p className="text-sm text-white/50 mb-4">💡 Arrastra los módulos para cambiar su orden</p>
            <div className="space-y-3">
              {modules
                .sort((a, b) => a.order - b.order)
                .map((module, index) => (
                  <div key={module.id}>
                    {editingModuleId === module.id ? (
                      // Edit Form
                      <div className="border border-ap-copper/50 rounded-2xl p-5 bg-ap-copper/10">
                        <h3 className="text-base font-semibold text-white mb-4">
                          Editar Módulo
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-white/70 mb-1">
                              Título
                            </label>
                            <input
                              type="text"
                              value={editModuleForm.title}
                              onChange={(e) =>
                                setEditModuleForm({
                                  ...editModuleForm,
                                  title: e.target.value,
                                })
                              }
                              className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-xl px-3 py-2 outline-none focus:border-ap-copper/50 transition text-sm"
                              placeholder="Nombre del módulo"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-white/70 mb-1">
                              Descripción
                            </label>
                            <textarea
                              value={editModuleForm.description}
                              onChange={(e) =>
                                setEditModuleForm({
                                  ...editModuleForm,
                                  description: e.target.value,
                                })
                              }
                              className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-xl px-3 py-2 outline-none focus:border-ap-copper/50 transition text-sm"
                              rows={2}
                            />
                          </div>

                          {/* Transcripción del Módulo */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm font-medium text-white/70">
                                Transcripción
                              </label>
                              <button
                                type="button"
                                onClick={() => editingModuleId && handleTranscribe('module', editingModuleId)}
                                disabled={!editingModuleId || !!transcribing[editingModuleId ?? '']}
                                className="text-xs px-3 py-1 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 disabled:opacity-50 transition"
                              >
                                {transcribing[editingModuleId ?? ''] ? '⏳ Transcribiendo...' : '✨ Transcribir'}
                              </button>
                            </div>
                            <textarea
                              value={editModuleForm.transcript}
                              onChange={(e) => setEditModuleForm({ ...editModuleForm, transcript: e.target.value })}
                              placeholder="Transcripción del video del módulo (se completa automáticamente al transcribir)..."
                              rows={4}
                              className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-indigo-500/50 transition"
                            />
                          </div>

                          {/* Lecciones del Módulo */}
                          <div className="border-t border-white/10 pt-4">
                            <div className="flex justify-between items-center mb-3">
                              <label className="block text-sm font-medium text-white/70">
                                Lecciones del Módulo
                              </label>
                              <button
                                onClick={() => {
                                  setShowLessonForms((prev) => ({ ...prev, [editingModuleId!]: !prev[editingModuleId!] }))
                                  setLessonForm({ title: '', description: '', videoUrl: '' })
                                  setShowVideoUploadLessonNew(false)
                                }}
                                className="text-xs px-3 py-1 bg-ap-copper text-white rounded-lg hover:bg-orange-700 transition"
                              >
                                {showLessonForms[editingModuleId!] ? 'Cancelar' : '+ Nueva Lección'}
                              </button>
                            </div>

                            {/* Create Lesson Form */}
                            {showLessonForms[editingModuleId!] && (
                              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-3 space-y-3">
                                <input
                                  type="text"
                                  placeholder="Título de la lección"
                                  value={lessonForm.title}
                                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                                  className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-ap-copper/50 transition"
                                />
                                <textarea
                                  placeholder="Descripción (opcional)"
                                  value={lessonForm.description}
                                  onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                                  rows={2}
                                  className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-ap-copper/50 transition"
                                />
                                {lessonForm.videoUrl ? (
                                  <div className="p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                                    <p className="text-xs text-green-400">✓ Video cargado</p>
                                    <button
                                      onClick={() => { setLessonForm({ ...lessonForm, videoUrl: '' }); setShowVideoUploadLessonNew(false) }}
                                      className="text-xs text-red-400 hover:text-red-300 mt-1 transition"
                                    >
                                      Cambiar video
                                    </button>
                                  </div>
                                ) : !showVideoUploadLessonNew ? (
                                  <button
                                    onClick={() => setShowVideoUploadLessonNew(true)}
                                    className="w-full px-3 py-1.5 border border-ap-copper/50 text-ap-copper rounded-lg hover:bg-ap-copper/10 text-xs font-medium transition"
                                  >
                                    📹 Subir video (opcional)
                                  </button>
                                ) : (
                                  <FileUploadProgress
                                    uploadType="video"
                                    moduleId="temp"
                                    onUploadComplete={(file) => {
                                      setLessonForm({ ...lessonForm, videoUrl: file.fileUrl })
                                      setShowVideoUploadLessonNew(false)
                                    }}
                                  />
                                )}
                                <button
                                  onClick={() => handleCreateLesson(editingModuleId!)}
                                  className="w-full px-3 py-2 bg-ap-copper text-white rounded-lg text-sm hover:bg-orange-700 transition font-medium"
                                >
                                  Crear Lección
                                </button>
                              </div>
                            )}

                            {/* Lessons List */}
                            <div className="space-y-2">
                              {(moduleLessons[editingModuleId!] || []).length === 0 ? (
                                <p className="text-sm text-white/40 italic">Sin lecciones. Crea una con el botón de arriba.</p>
                              ) : (
                                (moduleLessons[editingModuleId!] || []).map((lesson, li) => (
                                  <div key={lesson.id} className="border border-white/10 rounded-xl overflow-hidden">
                                    <div className="flex items-center justify-between px-3 py-2 bg-white/5">
                                      <button
                                        onClick={() => {
                                          if (expandedLessonId === lesson.id) {
                                            setExpandedLessonId(null)
                                          } else {
                                            setExpandedLessonId(lesson.id)
                                            setEditLessonForms((prev) => ({
                                              ...prev,
                                              [lesson.id]: {
                                                title: lesson.title,
                                                description: lesson.description || '',
                                                videoUrl: lesson.videoFileUrl || lesson.videoUrl || '',
                                                transcript: lesson.transcript || '',
                                              },
                                            }))
                                            setShowVideoUploadLessonEdit((prev) => ({ ...prev, [lesson.id]: false }))
                                          }
                                        }}
                                        className="flex-1 text-left text-sm font-medium text-white/80 hover:text-ap-copper transition"
                                      >
                                        {expandedLessonId === lesson.id ? '▼' : '▶'} {li + 1}. {lesson.title}
                                        {(lesson.videoFileUrl || lesson.videoUrl) && (
                                          <span className="ml-2 text-xs text-green-400 font-normal">✓ video</span>
                                        )}
                                      </button>
                                      <button
                                        onClick={() => handleDeleteLesson(editingModuleId!, lesson.id)}
                                        className="text-xs text-red-400 hover:text-red-300 ml-2 transition"
                                      >
                                        Eliminar
                                      </button>
                                    </div>

                                    {expandedLessonId === lesson.id && (
                                      <div className="px-3 pb-3 pt-2 space-y-2">
                                        <input
                                          type="text"
                                          value={editLessonForms[lesson.id]?.title || ''}
                                          onChange={(e) => setEditLessonForms((prev) => ({ ...prev, [lesson.id]: { ...prev[lesson.id], title: e.target.value } }))}
                                          className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-ap-copper/50 transition"
                                          placeholder="Título"
                                        />
                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-white/50">Descripción</span>
                                            <button
                                              type="button"
                                              onClick={() => handleGenerateSynopsis(lesson.id)}
                                              disabled={!!generatingSynopsis[lesson.id]}
                                              className="text-xs px-2 py-0.5 rounded-lg bg-ap-copper/10 text-ap-copper hover:bg-ap-copper/20 disabled:opacity-50 transition flex items-center gap-1"
                                            >
                                              {generatingSynopsis[lesson.id] ? '⏳ Generando...' : '✨ Generar con IA'}
                                            </button>
                                          </div>
                                          <textarea
                                            value={editLessonForms[lesson.id]?.description || ''}
                                            onChange={(e) => setEditLessonForms((prev) => ({ ...prev, [lesson.id]: { ...prev[lesson.id], description: e.target.value } }))}
                                            rows={2}
                                            className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-ap-copper/50 transition"
                                            placeholder="Descripción"
                                          />
                                        </div>
                                        {editLessonForms[lesson.id]?.videoUrl ? (
                                          <div className="p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                                            <p className="text-xs text-green-400">✓ Video cargado</p>
                                            <button
                                              onClick={() => {
                                                setEditLessonForms((prev) => ({ ...prev, [lesson.id]: { ...prev[lesson.id], videoUrl: '' } }))
                                                setShowVideoUploadLessonEdit((prev) => ({ ...prev, [lesson.id]: false }))
                                              }}
                                              className="text-xs text-red-400 hover:text-red-300 mt-1 transition"
                                            >
                                              Cambiar video
                                            </button>
                                          </div>
                                        ) : !showVideoUploadLessonEdit[lesson.id] ? (
                                          <button
                                            onClick={() => setShowVideoUploadLessonEdit((prev) => ({ ...prev, [lesson.id]: true }))}
                                            className="w-full px-3 py-1.5 border border-ap-copper/50 text-ap-copper rounded-lg hover:bg-ap-copper/10 text-xs font-medium transition"
                                          >
                                            📹 Subir video
                                          </button>
                                        ) : (
                                          <FileUploadProgress
                                            uploadType="video"
                                            lessonId={lesson.id}
                                            onUploadComplete={(file) => {
                                              setEditLessonForms((prev) => ({ ...prev, [lesson.id]: { ...prev[lesson.id], videoUrl: file.fileUrl } }))
                                              setShowVideoUploadLessonEdit((prev) => ({ ...prev, [lesson.id]: false }))
                                            }}
                                          />
                                        )}
                                        {/* Transcripción de la Lección */}
                                        <div>
                                          <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-medium text-white/60">Transcripción</label>
                                            <button
                                              type="button"
                                              onClick={() => handleTranscribe('lesson', lesson.id)}
                                              disabled={!!transcribing[lesson.id]}
                                              className="text-xs px-2 py-0.5 rounded-md bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 disabled:opacity-50 transition"
                                            >
                                              {transcribing[lesson.id] ? '⏳ Transcribiendo...' : '✨ Transcribir'}
                                            </button>
                                          </div>
                                          <textarea
                                            value={editLessonForms[lesson.id]?.transcript || ''}
                                            onChange={(e) => setEditLessonForms((prev) => ({ ...prev, [lesson.id]: { ...prev[lesson.id], transcript: e.target.value } }))}
                                            placeholder="Transcripción del video..."
                                            rows={3}
                                            className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-500/50 transition resize-none"
                                          />
                                        </div>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => handleSaveLesson(editingModuleId!, lesson.id)}
                                            className="flex-1 px-3 py-1.5 bg-ap-copper text-white rounded-lg text-xs hover:bg-orange-700 transition font-medium"
                                          >
                                            Guardar
                                          </button>
                                          <button
                                            onClick={() => setExpandedLessonId(null)}
                                            className="px-3 py-1.5 bg-white/10 text-white/70 rounded-lg text-xs hover:bg-white/15 transition"
                                          >
                                            Cancelar
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Recursos del Módulo */}
                          <div className="border-t border-white/10 pt-4">
                            <label className="block text-sm font-medium text-white/70 mb-2">
                              Recursos del módulo
                            </label>
                            {(moduleResources[editingModuleId!] || []).length > 0 && (
                              <div className="space-y-1 mb-3">
                                {(moduleResources[editingModuleId!] || []).map((r: any) => (
                                  <div key={r.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-sm">📄</span>
                                      <span className="text-xs text-white/70 truncate">{r.title}</span>
                                    </div>
                                    <button
                                      onClick={() => handleDeleteModuleResource(editingModuleId!, r.id)}
                                      className="text-xs text-red-400 hover:text-red-300 ml-2 shrink-0 transition"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <FileUploadProgress
                              uploadType="resource"
                              moduleId={editingModuleId || ''}
                              onUploadComplete={() => fetchModuleResources(editingModuleId!)}
                            />
                          </div>

                          {/* Tests del Módulo */}
                          <div className="border-t border-white/10 pt-4">
                            <div className="flex justify-between items-center mb-3">
                              <label className="block text-sm font-medium text-white/70">
                                Tests del Módulo
                              </label>
                              <button
                                onClick={() => setShowTestForm(!showTestForm)}
                                className="text-xs px-3 py-1 bg-ap-copper text-white rounded-lg hover:bg-orange-700 transition"
                              >
                                {showTestForm ? 'Cancelar' : '+ Nuevo Test'}
                              </button>
                            </div>

                            {/* Create Test Form */}
                            {showTestForm && (
                              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-3 space-y-3">
                                <input
                                  type="text"
                                  placeholder="Título del test"
                                  value={testForm.title}
                                  onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
                                  className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-lg px-3 py-2 text-sm outline-none focus:border-ap-copper/50 transition"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs text-white/50 mb-1">
                                      Intentos (0 = ilimitados)
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      value={testForm.maxAttempts}
                                      onChange={(e) => setTestForm({ ...testForm, maxAttempts: parseInt(e.target.value) || 0 })}
                                      className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 text-sm outline-none focus:border-ap-copper/50 transition"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-white/50 mb-1">
                                      Puntaje mínimo (%)
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={testForm.passingScore}
                                      onChange={(e) => setTestForm({ ...testForm, passingScore: parseInt(e.target.value) || 0 })}
                                      className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 text-sm outline-none focus:border-ap-copper/50 transition"
                                    />
                                  </div>
                                </div>
                                <label className="flex items-center gap-2 text-sm text-white/70">
                                  <input
                                    type="checkbox"
                                    checked={testForm.isRequired}
                                    onChange={(e) => setTestForm({ ...testForm, isRequired: e.target.checked })}
                                    className="rounded"
                                  />
                                  Requerido para aprobar el módulo
                                </label>
                                <button
                                  onClick={() => handleCreateTest(editingModuleId!)}
                                  className="w-full px-3 py-2 bg-ap-copper text-white rounded-lg text-sm hover:bg-orange-700 transition font-medium"
                                >
                                  Crear Test
                                </button>
                              </div>
                            )}

                            {/* Tests List */}
                            <div className="space-y-2">
                              {(moduleTests[editingModuleId!] || []).length === 0 ? (
                                <p className="text-sm text-white/40 italic">Sin tests. Crea uno con el botón de arriba.</p>
                              ) : (
                                (moduleTests[editingModuleId!] || []).map((test) => (
                                  <div key={test.id} className="border border-white/10 rounded-xl overflow-hidden">
                                    {/* Test header */}
                                    <div className="flex items-center justify-between px-3 py-2 bg-white/5">
                                      <button
                                        onClick={() => handleToggleTest(editingModuleId!, test.id)}
                                        className="flex-1 text-left text-sm font-medium text-white/80 hover:text-ap-copper transition"
                                      >
                                        {expandedTestId === test.id ? '▼' : '▶'} {test.title}
                                        <span className="ml-2 text-xs text-white/40 font-normal">
                                          {test.questionCount ?? 0} pregunta{test.questionCount !== 1 ? 's' : ''}
                                          {' · '}
                                          {test.maxAttempts === 0 ? 'ilimitados' : `${test.maxAttempts} intento${test.maxAttempts !== 1 ? 's' : ''}`}
                                          {' · '}
                                          {test.passingScore}% mín.
                                          {test.isRequired ? ' · Requerido' : ''}
                                        </span>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTest(editingModuleId!, test.id)}
                                        className="text-xs text-red-400 hover:text-red-300 ml-2 transition"
                                      >
                                        Eliminar
                                      </button>
                                    </div>

                                    {/* Questions (expanded) */}
                                    {expandedTestId === test.id && (
                                      <div className="px-3 pb-3 pt-2 space-y-2">
                                        {/* Existing questions */}
                                        {(testQuestions[test.id] || []).map((q, qi) => (
                                          <div key={q.id} className="flex items-start gap-2 bg-white/5 border border-white/10 rounded-lg p-2 text-sm">
                                            <span className="text-white/40 font-medium shrink-0">{qi + 1}.</span>
                                            <div className="flex-1">
                                              <p className="text-white/80">{q.title}</p>
                                              <div className="flex flex-wrap gap-2 mt-1">
                                                {(q.config.options || []).map((opt: string) => (
                                                  <span
                                                    key={opt}
                                                    className={`text-xs px-2 py-0.5 rounded-full ${
                                                      opt === q.config.correctAnswer
                                                        ? 'bg-green-500/20 text-green-400 font-medium'
                                                        : 'bg-white/10 text-white/50'
                                                    }`}
                                                  >
                                                    {opt === q.config.correctAnswer ? '✓ ' : ''}{opt}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => handleDeleteQuestion(editingModuleId!, test.id, q.id)}
                                              className="text-xs text-red-400 hover:text-red-300 shrink-0 transition"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        ))}

                                        {/* Add question form */}
                                        <div className="border border-dashed border-white/20 rounded-lg p-3 space-y-2">
                                          <p className="text-xs font-medium text-white/50">+ Agregar pregunta</p>
                                          <input
                                            type="text"
                                            placeholder="Texto de la pregunta"
                                            value={questionForms[test.id]?.title || ''}
                                            onChange={(e) =>
                                              setQuestionForms((prev) => ({
                                                ...prev,
                                                [test.id]: {
                                                  ...(prev[test.id] || { title: '', options: ['', ''], correctIndex: 0 }),
                                                  title: e.target.value,
                                                },
                                              }))
                                            }
                                            className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-ap-copper/50 transition"
                                          />
                                          <div className="space-y-1">
                                            {(questionForms[test.id]?.options || ['', '']).map((opt, oi) => (
                                              <div key={oi} className="flex items-center gap-2">
                                                <input
                                                  type="radio"
                                                  name={`correct-${test.id}`}
                                                  checked={(questionForms[test.id]?.correctIndex ?? 0) === oi}
                                                  onChange={() =>
                                                    setQuestionForms((prev) => ({
                                                      ...prev,
                                                      [test.id]: {
                                                        ...(prev[test.id] || { title: '', options: ['', ''], correctIndex: 0 }),
                                                        correctIndex: oi,
                                                      },
                                                    }))
                                                  }
                                                  title="Marcar como respuesta correcta"
                                                />
                                                <input
                                                  type="text"
                                                  placeholder={`Opción ${oi + 1}`}
                                                  value={opt}
                                                  onChange={(e) => {
                                                    const newOptions = [...(questionForms[test.id]?.options || ['', ''])]
                                                    newOptions[oi] = e.target.value
                                                    setQuestionForms((prev) => ({
                                                      ...prev,
                                                      [test.id]: {
                                                        ...(prev[test.id] || { title: '', options: ['', ''], correctIndex: 0 }),
                                                        options: newOptions,
                                                      },
                                                    }))
                                                  }}
                                                  className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-lg px-2 py-1 text-sm outline-none focus:border-ap-copper/50 transition"
                                                />
                                                {(questionForms[test.id]?.options || ['', '']).length > 2 && (
                                                  <button
                                                    onClick={() => {
                                                      const current = questionForms[test.id] || { title: '', options: ['', ''], correctIndex: 0 }
                                                      const newOptions = current.options.filter((_, i) => i !== oi)
                                                      const newCorrect = current.correctIndex === oi
                                                        ? 0
                                                        : current.correctIndex > oi
                                                        ? current.correctIndex - 1
                                                        : current.correctIndex
                                                      setQuestionForms((prev) => ({
                                                        ...prev,
                                                        [test.id]: { ...current, options: newOptions, correctIndex: newCorrect },
                                                      }))
                                                    }}
                                                    className="text-white/30 hover:text-red-400 transition text-xs shrink-0"
                                                    title="Eliminar opción"
                                                  >
                                                    ✕
                                                  </button>
                                                )}
                                              </div>
                                            ))}
                                            {(questionForms[test.id]?.options || ['', '']).length < 4 && (
                                              <button
                                                onClick={() => {
                                                  const current = questionForms[test.id] || { title: '', options: ['', ''], correctIndex: 0 }
                                                  setQuestionForms((prev) => ({
                                                    ...prev,
                                                    [test.id]: { ...current, options: [...current.options, ''] },
                                                  }))
                                                }}
                                                className="text-xs text-white/40 hover:text-white/70 transition mt-1"
                                              >
                                                + Agregar opción
                                              </button>
                                            )}
                                            <p className="text-xs text-white/40">Selecciona el radio de la respuesta correcta</p>
                                          </div>
                                          <button
                                            onClick={() => handleAddQuestion(editingModuleId!, test.id)}
                                            className="w-full px-2 py-1.5 bg-white/10 text-white/80 rounded-lg text-xs hover:bg-white/15 transition"
                                          >
                                            Agregar pregunta
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveModuleChanges}
                              className="flex-1 bg-ap-copper hover:bg-orange-700 text-white px-4 py-2 rounded-xl font-medium transition text-sm"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="flex-1 px-4 py-2 bg-white/10 text-white/80 rounded-xl hover:bg-white/15 transition text-sm"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Module Display - Draggable
                      <div
                        draggable
                        onDragStart={() => handleDragStart(module.id)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        className={`border-2 rounded-2xl p-4 cursor-move transition-colors ${
                          draggedModuleId === module.id
                            ? 'border-ap-copper bg-ap-copper/20 opacity-50'
                            : dragOverIndex === index
                            ? 'border-ap-copper bg-ap-copper/10'
                            : 'border-white/10 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-2xl text-white/30">⋮⋮</span>
                              <span className="text-sm font-bold text-ap-copper bg-ap-copper/10 px-2 py-1 rounded-lg">
                                Módulo {module.order}
                              </span>
                              <h3 className="font-semibold text-white">
                                {module.title}
                              </h3>
                            </div>
                            {module.description && (
                              <p className="text-sm text-white/60 ml-10">{module.description}</p>
                            )}
                            {module.videoUrl && (
                              <p className="text-xs text-white/40 mt-1 ml-10 truncate max-w-md">
                                Video: {module.videoUrl}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-3 ml-4">
                            <button
                              onClick={() => handleEditModule(module)}
                              className="text-ap-copper hover:text-orange-400 text-sm font-medium transition"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteModule(module.id, module.title)}
                              className="text-red-400 hover:text-red-300 text-sm font-medium transition"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </>
        )}
      </div>

      {/* Course Tests Section */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Tests del Curso</h2>
            <p className="text-sm text-white/50 mt-1">Cuestionarios opcionales o examen final para el curso</p>
          </div>
          <button
            onClick={() => setShowCourseTestForm(!showCourseTestForm)}
            className="bg-ap-copper hover:bg-orange-700 text-white px-4 py-2 rounded-xl font-medium transition text-sm"
          >
            {showCourseTestForm ? 'Cancelar' : '+ Nuevo Test'}
          </button>
        </div>

        {/* Create Course Test Form */}
        {showCourseTestForm && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 space-y-4">
            <h3 className="text-sm font-semibold text-white/80">Nuevo test del curso</h3>
            <input
              type="text"
              placeholder="Título del test"
              value={courseTestForm.title}
              onChange={(e) => setCourseTestForm({ ...courseTestForm, title: e.target.value })}
              className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-xl px-3 py-2 text-sm outline-none focus:border-ap-copper/50 transition"
            />
            <textarea
              placeholder="Descripción (opcional)"
              value={courseTestForm.description}
              onChange={(e) => setCourseTestForm({ ...courseTestForm, description: e.target.value })}
              className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-xl px-3 py-2 text-sm outline-none focus:border-ap-copper/50 transition"
              rows={2}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/50 mb-1">Intentos (0 = ilimitados)</label>
                <input
                  type="number"
                  min={0}
                  value={courseTestForm.maxAttempts}
                  onChange={(e) => setCourseTestForm({ ...courseTestForm, maxAttempts: parseInt(e.target.value) || 0 })}
                  className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-1.5 text-sm outline-none focus:border-ap-copper/50 transition"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Puntaje mínimo (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={courseTestForm.passingScore}
                  onChange={(e) => setCourseTestForm({ ...courseTestForm, passingScore: parseInt(e.target.value) || 0 })}
                  className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-1.5 text-sm outline-none focus:border-ap-copper/50 transition"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={courseTestForm.isRequired}
                  onChange={(e) => setCourseTestForm({ ...courseTestForm, isRequired: e.target.checked })}
                  className="rounded"
                />
                Requerido
              </label>
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={courseTestForm.isFinalExam}
                  onChange={(e) => setCourseTestForm({ ...courseTestForm, isFinalExam: e.target.checked })}
                  className="rounded"
                />
                Examen final
              </label>
            </div>
            <button
              onClick={handleCreateCourseTest}
              className="w-full px-3 py-2 bg-ap-copper text-white rounded-xl text-sm hover:bg-orange-700 transition font-medium"
            >
              Crear Test
            </button>
          </div>
        )}

        {/* Course Tests List */}
        {courseTests.length === 0 ? (
          <p className="text-white/40 italic text-sm">Sin tests. Crea uno con el botón de arriba.</p>
        ) : (
          <div className="space-y-3">
            {courseTests.map((test) => (
              <div key={test.id} className="border border-white/10 rounded-2xl overflow-hidden">
                {/* Test Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-white/5">
                  <button
                    onClick={() => handleToggleCourseTest(test.id)}
                    className="flex-1 text-left text-sm font-medium text-white/80 hover:text-ap-copper transition"
                  >
                    {expandedCourseTestId === test.id ? '▼' : '▶'} {test.title}
                    {test.isFinalExam && (
                      <span className="ml-2 text-xs bg-ap-copper/20 text-ap-copper border border-ap-copper/30 rounded-full px-2 py-0.5">
                        Examen Final
                      </span>
                    )}
                    <span className="ml-2 text-xs text-white/40 font-normal">
                      {test._count?.questions ?? 0} pregunta{test._count?.questions !== 1 ? 's' : ''}
                      {' · '}{test.maxAttempts === 0 ? 'ilimitados' : `${test.maxAttempts} intento${test.maxAttempts !== 1 ? 's' : ''}`}
                      {' · '}{test.passingScore}% mín.
                      {test.isRequired ? ' · Requerido' : ''}
                    </span>
                  </button>
                  <div className="flex items-center gap-3 ml-2">
                    <a
                      href={`/api/admin/courses/${courseId}/tests/${test.id}/submissions?status=PENDING`}
                      target="_blank"
                      className="text-xs text-white/50 hover:text-ap-copper transition"
                    >
                      Ver entregas ({test._count?.submissions ?? 0})
                    </a>
                    <button
                      onClick={() => handleDeleteCourseTest(test.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {/* Questions Panel (expanded) */}
                {expandedCourseTestId === test.id && (
                  <div className="px-4 pb-4 pt-3 space-y-3">
                    {/* Existing Questions */}
                    {(courseTestQuestions[test.id] || []).map((q, qi) => (
                      <div key={q.id} className="flex items-start gap-2 bg-white/5 border border-white/10 rounded-xl p-3 text-sm">
                        <span className="text-white/40 font-medium shrink-0">{qi + 1}.</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                              {q.type === 'MULTIPLE_CHOICE' ? 'Selección múltiple' : q.type === 'WRITTEN' ? 'Escrita' : 'Archivo'}
                            </span>
                          </div>
                          <p className="text-white/80">{q.title}</p>
                          {q.type === 'MULTIPLE_CHOICE' && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              {(q.config.options || []).map((opt: string) => (
                                <span
                                  key={opt}
                                  className={`text-xs px-2 py-0.5 rounded-full ${
                                    opt === q.config.correctAnswer
                                      ? 'bg-green-500/20 text-green-400 font-medium'
                                      : 'bg-white/10 text-white/50'
                                  }`}
                                >
                                  {opt === q.config.correctAnswer ? '✓ ' : ''}{opt}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteCourseTestQuestion(test.id, q.id)}
                          className="text-xs text-red-400 hover:text-red-300 shrink-0 transition"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {/* Add Question Form */}
                    <div className="border border-dashed border-white/20 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-medium text-white/50">+ Agregar pregunta</p>

                      {/* Question Type Selector */}
                      <div className="flex gap-2">
                        {(['MULTIPLE_CHOICE', 'WRITTEN', 'FILE_UPLOAD'] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => setCourseTestQuestionForms((prev) => ({
                              ...prev,
                              [test.id]: { ...(prev[test.id] || { title: '', options: ['', ''], correctIndex: 0 }), type },
                            }))}
                            className={`text-xs px-2 py-1 rounded-lg transition ${
                              (courseTestQuestionForms[test.id]?.type ?? 'MULTIPLE_CHOICE') === type
                                ? 'bg-ap-copper text-white'
                                : 'bg-white/10 text-white/50 hover:bg-white/15'
                            }`}
                          >
                            {type === 'MULTIPLE_CHOICE' ? 'Selección múltiple' : type === 'WRITTEN' ? 'Respuesta escrita' : 'Subir archivo'}
                          </button>
                        ))}
                      </div>

                      <input
                        type="text"
                        placeholder="Texto de la pregunta"
                        value={courseTestQuestionForms[test.id]?.title || ''}
                        onChange={(e) => setCourseTestQuestionForms((prev) => ({
                          ...prev,
                          [test.id]: { ...(prev[test.id] || { type: 'MULTIPLE_CHOICE', title: '', options: ['', ''], correctIndex: 0 }), title: e.target.value },
                        }))}
                        className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-xl px-3 py-2 text-sm outline-none focus:border-ap-copper/50 transition"
                      />

                      {/* MC Options */}
                      {(courseTestQuestionForms[test.id]?.type ?? 'MULTIPLE_CHOICE') === 'MULTIPLE_CHOICE' && (
                        <div className="space-y-1">
                          {(courseTestQuestionForms[test.id]?.options || ['', '']).map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`ct-correct-${test.id}`}
                                checked={(courseTestQuestionForms[test.id]?.correctIndex ?? 0) === oi}
                                onChange={() => setCourseTestQuestionForms((prev) => ({
                                  ...prev,
                                  [test.id]: { ...(prev[test.id] || { type: 'MULTIPLE_CHOICE', title: '', options: ['', ''], correctIndex: 0 }), correctIndex: oi },
                                }))}
                                title="Marcar como respuesta correcta"
                              />
                              <input
                                type="text"
                                placeholder={`Opción ${oi + 1}`}
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...(courseTestQuestionForms[test.id]?.options || ['', ''])]
                                  newOpts[oi] = e.target.value
                                  setCourseTestQuestionForms((prev) => ({
                                    ...prev,
                                    [test.id]: { ...(prev[test.id] || { type: 'MULTIPLE_CHOICE', title: '', options: ['', ''], correctIndex: 0 }), options: newOpts },
                                  }))
                                }}
                                className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-lg px-2 py-1 text-sm outline-none focus:border-ap-copper/50 transition"
                              />
                              {(courseTestQuestionForms[test.id]?.options || ['', '']).length > 2 && (
                                <button
                                  onClick={() => {
                                    const cur = courseTestQuestionForms[test.id] || { type: 'MULTIPLE_CHOICE' as const, title: '', options: ['', ''], correctIndex: 0 }
                                    const newOpts = cur.options.filter((_, i) => i !== oi)
                                    const newIdx = cur.correctIndex === oi ? 0 : cur.correctIndex > oi ? cur.correctIndex - 1 : cur.correctIndex
                                    setCourseTestQuestionForms((prev) => ({ ...prev, [test.id]: { ...cur, options: newOpts, correctIndex: newIdx } }))
                                  }}
                                  className="text-white/30 hover:text-red-400 text-xs transition"
                                >✕</button>
                              )}
                            </div>
                          ))}
                          {(courseTestQuestionForms[test.id]?.options || ['', '']).length < 4 && (
                            <button
                              onClick={() => {
                                const cur = courseTestQuestionForms[test.id] || { type: 'MULTIPLE_CHOICE' as const, title: '', options: ['', ''], correctIndex: 0 }
                                setCourseTestQuestionForms((prev) => ({ ...prev, [test.id]: { ...cur, options: [...cur.options, ''] } }))
                              }}
                              className="text-xs text-white/40 hover:text-white/70 transition"
                            >
                              + Agregar opción
                            </button>
                          )}
                          <p className="text-xs text-white/40">Selecciona el radio de la respuesta correcta</p>
                        </div>
                      )}

                      {(courseTestQuestionForms[test.id]?.type === 'WRITTEN') && (
                        <p className="text-xs text-white/40">El estudiante escribirá su respuesta. Requiere revisión manual.</p>
                      )}
                      {(courseTestQuestionForms[test.id]?.type === 'FILE_UPLOAD') && (
                        <p className="text-xs text-white/40">El estudiante subirá una foto, video o PDF. Requiere revisión manual.</p>
                      )}

                      <button
                        onClick={() => handleAddCourseTestQuestion(test.id)}
                        className="w-full px-2 py-1.5 bg-white/10 text-white/80 rounded-xl text-xs hover:bg-white/15 transition"
                      >
                        Agregar pregunta
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

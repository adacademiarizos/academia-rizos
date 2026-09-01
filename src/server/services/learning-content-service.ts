import {
  AssessmentAttemptStatus,
  AssessmentQuestionType,
  LearningScope,
  Prisma,
} from '@prisma/client'
import { db } from '@/lib/db'
import { RESOURCE_MAX_BYTES } from '@/lib/upload-contract'
import { normalizeCertificateSlogan } from '@/validators/course.schema'
import { generateAndSaveCertificate } from '@/server/services/certificate.service'

export type ScopeRef = {
  scope: LearningScope
  scopeId: string
}

export type AssessmentAnswerInput = {
  questionId: string
  responseText?: string
  fileUrl?: string
  fileMimeType?: string
}

export type AssessmentQuestionInput = {
  type: AssessmentQuestionType
  title: string
  description?: string
  order?: number
  required?: boolean
  options?: string[]
  correctAnswer?: string
  config?: unknown
}

export class LearningContentError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = 'LEARNING_CONTENT_ERROR'
  ) {
    super(message)
    this.name = 'LearningContentError'
  }
}

type ScopeTarget = ScopeRef & { courseId: string }

const scopeParentKey: Record<LearningScope, 'courseId' | 'moduleId' | 'styleId' | 'lessonId'> = {
  COURSE: 'courseId',
  MODULE: 'moduleId',
  STYLE: 'styleId',
  LESSON: 'lessonId',
}

function toScopeData(target: ScopeTarget) {
  return { [scopeParentKey[target.scope]]: target.scopeId }
}

function isManualQuestion(type: AssessmentQuestionType) {
  return type !== AssessmentQuestionType.MULTIPLE_CHOICE
}

export function requiresManualReview(questionTypes: AssessmentQuestionType[]) {
  return questionTypes.some(isManualQuestion)
}

export function calculateMultipleChoiceScore(
  questions: Array<{ id: string; correctAnswer: string | null }>,
  answers: Map<string, AssessmentAnswerInput>
) {
  if (questions.length === 0) return 0
  const correct = questions.filter((question) => answers.get(question.id)?.responseText === question.correctAnswer).length
  return (correct / questions.length) * 100
}

function normalizeQuestion(question: AssessmentQuestionInput, index: number) {
  const title = question.title.trim()
  if (!title) throw new LearningContentError('Cada pregunta debe tener un enunciado.')

  if (question.type === AssessmentQuestionType.MULTIPLE_CHOICE) {
    const options = question.options?.map((option) => option.trim()).filter(Boolean) ?? []
    if (options.length < 2) {
      throw new LearningContentError('Una pregunta de selección múltiple necesita al menos dos opciones.')
    }
    if (!question.correctAnswer || !options.includes(question.correctAnswer)) {
      throw new LearningContentError('La respuesta correcta debe ser una de las opciones definidas.')
    }
    return {
      type: question.type,
      title,
      description: question.description?.trim() || null,
      order: question.order ?? index,
      required: question.required ?? true,
      options,
      correctAnswer: question.correctAnswer,
      config: question.config === undefined ? undefined : question.config as Prisma.InputJsonValue,
    }
  }

  return {
    type: question.type,
    title,
    description: question.description?.trim() || null,
    order: question.order ?? index,
    required: question.required ?? true,
    options: Prisma.JsonNull,
    correctAnswer: null,
    config: question.config === undefined ? undefined : question.config as Prisma.InputJsonValue,
  }
}

export async function resolveScopeTarget(ref: ScopeRef): Promise<ScopeTarget> {
  if (!ref.scopeId) throw new LearningContentError('Falta el identificador del contexto.')

  switch (ref.scope) {
    case LearningScope.COURSE: {
      const course = await db.course.findUnique({ where: { id: ref.scopeId }, select: { id: true } })
      if (!course) throw new LearningContentError('El curso no existe.', 404, 'SCOPE_NOT_FOUND')
      return { ...ref, courseId: course.id }
    }
    case LearningScope.MODULE: {
      const learningModule = await db.module.findUnique({ where: { id: ref.scopeId }, select: { id: true, courseId: true } })
      if (!learningModule) throw new LearningContentError('El módulo no existe.', 404, 'SCOPE_NOT_FOUND')
      return { ...ref, courseId: learningModule.courseId }
    }
    case LearningScope.STYLE: {
      const style = await db.moduleStyle.findUnique({
        where: { id: ref.scopeId },
        select: { id: true, courseId: true },
      })
      if (!style) throw new LearningContentError('El estilo no existe.', 404, 'SCOPE_NOT_FOUND')
      return { ...ref, courseId: style.courseId }
    }
    case LearningScope.LESSON: {
      const lesson = await db.lesson.findUnique({
        where: { id: ref.scopeId },
        select: {
          id: true,
          module: { select: { courseId: true } },
          style: { select: { courseId: true } },
        },
      })
      if (!lesson) throw new LearningContentError('La lección no existe.', 404, 'SCOPE_NOT_FOUND')
      const courseId = lesson.module?.courseId ?? lesson.style?.courseId
      if (!courseId) throw new LearningContentError('La lección no tiene un curso válido.', 500, 'INVALID_LESSON_SCOPE')
      return { ...ref, courseId }
    }
  }
}

export async function listLearningResources(ref: ScopeRef) {
  const target = await resolveScopeTarget(ref)
  return db.learningResource.findMany({
    where: { scope: target.scope, ...toScopeData(target) },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })
}

export async function createLearningResource(
  ref: ScopeRef,
  input: { title: string; fileUrl: string; fileType: string; fileSize: number; order?: number }
) {
  const target = await resolveScopeTarget(ref)
  if (!input.title.trim() || !input.fileUrl.trim() || !input.fileType.trim()) {
    throw new LearningContentError('Título, archivo y tipo de archivo son obligatorios.')
  }
  if (!Number.isInteger(input.fileSize) || input.fileSize <= 0 || input.fileSize > RESOURCE_MAX_BYTES) {
    throw new LearningContentError('El tamaño del archivo no es válido.')
  }

  return db.learningResource.create({
    data: {
      scope: target.scope,
      ...toScopeData(target),
      title: input.title.trim(),
      fileUrl: input.fileUrl.trim(),
      fileType: input.fileType.trim(),
      fileSize: input.fileSize,
      order: input.order ?? 0,
    },
  })
}

export async function deleteLearningResource(resourceId: string) {
  const resource = await db.learningResource.findUnique({
    where: { id: resourceId },
    select: { id: true, scope: true, courseId: true, moduleId: true, styleId: true, lessonId: true },
  })
  if (!resource) throw new LearningContentError('El recurso no existe.', 404, 'RESOURCE_NOT_FOUND')
  await db.learningResource.delete({ where: { id: resourceId } })
  return resource
}

/**
 * `withAttempts` is admin-only on purpose: the student route calls this too, and
 * including other people's attempts there would expose them.
 */
export async function listAssessments(
  ref: ScopeRef,
  options: { publishedOnly?: boolean; withAttempts?: boolean } = {}
) {
  const target = await resolveScopeTarget(ref)
  return db.assessment.findMany({
    where: {
      scope: target.scope,
      ...toScopeData(target),
      ...(options.publishedOnly ? { publishedAt: { not: null, lte: new Date() } } : {}),
    },
    include: {
      questions: { orderBy: { order: 'asc' } },
      ...(options.withAttempts
        ? {
            attempts: {
              orderBy: { submittedAt: 'desc' as const },
              select: {
                id: true,
                attemptNumber: true,
                status: true,
                score: true,
                submittedAt: true,
                student: { select: { id: true, name: true, email: true } },
              },
            },
            revalidations: { select: { userId: true, attemptsGranted: true } },
          }
        : {}),
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })
}

export async function createAssessment(
  ref: ScopeRef,
  input: {
    title: string
    description?: string
    order?: number
    isRequired?: boolean
    isFinalExam?: boolean
    maxAttempts?: number
    passingScore?: number
    published?: boolean
    questions: AssessmentQuestionInput[]
  }
) {
  const target = await resolveScopeTarget(ref)
  const title = input.title.trim()
  const maxAttempts = input.maxAttempts ?? 1
  const passingScore = input.passingScore ?? 70
  if (!title) throw new LearningContentError('La evaluación debe tener un título.')
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new LearningContentError('Los intentos deben ser un número entero mayor que cero.')
  }
  if (!Number.isInteger(passingScore) || passingScore < 0 || passingScore > 100) {
    throw new LearningContentError('La nota mínima debe estar entre 0 y 100.')
  }
  if (input.isFinalExam && target.scope !== LearningScope.COURSE) {
    throw new LearningContentError('Solo una evaluación de curso puede marcarse como examen final.')
  }
  if (input.isFinalExam && !input.isRequired) {
    throw new LearningContentError('El examen final certificable debe ser obligatorio.')
  }
  const questions = input.questions.map(normalizeQuestion)
  if (questions.length === 0) throw new LearningContentError('La evaluación necesita al menos una pregunta.')

  try {
    return await db.assessment.create({
      data: {
        scope: target.scope,
        ...toScopeData(target),
        title,
        description: input.description?.trim() || null,
        order: input.order ?? 0,
        isRequired: input.isRequired ?? false,
        isFinalExam: input.isFinalExam ?? false,
        maxAttempts,
        passingScore,
        publishedAt: input.published === false ? null : new Date(),
        questions: { create: questions },
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new LearningContentError('Este curso ya tiene un examen final certificable.', 409, 'FINAL_EXAM_EXISTS')
    }
    throw error
  }
}

export async function updateAssessment(
  assessmentId: string,
  input: Partial<{
    title: string
    description: string
    order: number
    isRequired: boolean
    isFinalExam: boolean
    maxAttempts: number
    passingScore: number
    published: boolean
    questions: AssessmentQuestionInput[]
  }>
) {
  const current = await db.assessment.findUnique({ where: { id: assessmentId }, select: { id: true, scope: true, isRequired: true } })
  if (!current) throw new LearningContentError('La evaluación no existe.', 404, 'ASSESSMENT_NOT_FOUND')
  if (input.isFinalExam && current.scope !== LearningScope.COURSE) {
    throw new LearningContentError('Solo una evaluación de curso puede ser final.')
  }
  if (input.isFinalExam && input.isRequired === false) {
    throw new LearningContentError('El examen final certificable debe ser obligatorio.')
  }
  if (input.isFinalExam && !current.isRequired && input.isRequired !== true) {
    throw new LearningContentError('Marca la evaluación como obligatoria antes de convertirla en examen final.')
  }
  if (input.maxAttempts !== undefined && (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1)) {
    throw new LearningContentError('Los intentos deben ser un número entero mayor que cero.')
  }
  if (input.passingScore !== undefined && (!Number.isInteger(input.passingScore) || input.passingScore < 0 || input.passingScore > 100)) {
    throw new LearningContentError('La nota mínima debe estar entre 0 y 100.')
  }
  const questions = input.questions?.map(normalizeQuestion)
  if (questions && questions.length === 0) throw new LearningContentError('La evaluación necesita al menos una pregunta.')

  try {
    return await db.assessment.update({
      where: { id: assessmentId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
        ...(input.order !== undefined ? { order: input.order } : {}),
        ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
        ...(input.isFinalExam !== undefined ? { isFinalExam: input.isFinalExam } : {}),
        ...(input.maxAttempts !== undefined ? { maxAttempts: input.maxAttempts } : {}),
        ...(input.passingScore !== undefined ? { passingScore: input.passingScore } : {}),
        ...(input.published !== undefined ? { publishedAt: input.published ? new Date() : null } : {}),
        ...(questions ? { questions: { deleteMany: {}, create: questions } } : {}),
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new LearningContentError('Este curso ya tiene un examen final certificable.', 409, 'FINAL_EXAM_EXISTS')
    }
    throw error
  }
}

export async function deleteAssessment(assessmentId: string) {
  const assessment = await db.assessment.findUnique({ where: { id: assessmentId }, select: { id: true } })
  if (!assessment) throw new LearningContentError('La evaluación no existe.', 404, 'ASSESSMENT_NOT_FOUND')
  await db.assessment.delete({ where: { id: assessmentId } })
}

async function approvedAssessmentIds(userId: string, assessmentIds: string[]) {
  if (assessmentIds.length === 0) return new Set<string>()
  const attempts = await db.assessmentAttempt.findMany({
    where: { userId, assessmentId: { in: assessmentIds }, status: AssessmentAttemptStatus.APPROVED },
    select: { assessmentId: true },
    distinct: ['assessmentId'],
  })
  return new Set(attempts.map((attempt) => attempt.assessmentId))
}

export async function getCourseLearningProgress(userId: string, courseId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      modules: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          lessons: { select: { id: true } },
        },
      },
      styles: {
        orderBy: { order: 'asc' },
        select: { id: true, lessons: { orderBy: { order: 'asc' }, select: { id: true } } },
      },
    },
  })
  if (!course) throw new LearningContentError('El curso no existe.', 404, 'COURSE_NOT_FOUND')

  const [assessments, lessonProgress] = await Promise.all([
    db.assessment.findMany({
      where: { courseId, scope: LearningScope.COURSE },
      select: { id: true, scope: true, moduleId: true, styleId: true, lessonId: true, isRequired: true, isFinalExam: true },
    }).then(async (courseAssessments) => {
      const moduleIds = course.modules.map((module) => module.id)
      const styleIds = course.styles.map((style) => style.id)
      const lessonIds = [
        ...course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)),
        ...course.styles.flatMap((style) => style.lessons.map((lesson) => lesson.id)),
      ]
      const child = await db.assessment.findMany({
        where: {
          OR: [
            { moduleId: { in: moduleIds }, scope: LearningScope.MODULE },
            { styleId: { in: styleIds }, scope: LearningScope.STYLE },
            { lessonId: { in: lessonIds }, scope: LearningScope.LESSON },
          ],
        },
        select: { id: true, scope: true, moduleId: true, styleId: true, lessonId: true, isRequired: true, isFinalExam: true },
      })
      return [...courseAssessments, ...child]
    }),
    db.lessonProgress.findMany({
      where: {
        userId,
        lesson: { OR: [{ module: { courseId } }, { style: { courseId } }] },
      },
      select: { lessonId: true },
    }),
  ])
  const passed = await approvedAssessmentIds(userId, assessments.filter((item) => item.isRequired).map((item) => item.id))
  const completedLessonIds = new Set(lessonProgress.map((item) => item.lessonId))
  const requiredByLesson = new Map<string, string[]>()
  const requiredByStyle = new Map<string, string[]>()
  const requiredByModule = new Map<string, string[]>()
  const requiredCourse = assessments.filter((item) => item.scope === LearningScope.COURSE && item.isRequired && !item.isFinalExam).map((item) => item.id)
  const finalAssessment = assessments.find((item) => item.scope === LearningScope.COURSE && item.isFinalExam)

  for (const assessment of assessments) {
    if (!assessment.isRequired) continue
    if (assessment.scope === LearningScope.LESSON && assessment.lessonId) {
      requiredByLesson.set(assessment.lessonId, [...(requiredByLesson.get(assessment.lessonId) ?? []), assessment.id])
    }
    if (assessment.scope === LearningScope.STYLE && assessment.styleId) {
      requiredByStyle.set(assessment.styleId, [...(requiredByStyle.get(assessment.styleId) ?? []), assessment.id])
    }
    if (assessment.scope === LearningScope.MODULE && assessment.moduleId) {
      requiredByModule.set(assessment.moduleId, [...(requiredByModule.get(assessment.moduleId) ?? []), assessment.id])
    }
  }

  const allLessons = [
    ...course.modules.flatMap((module) => module.lessons),
    ...course.styles.flatMap((style) => style.lessons),
  ]
  const lessons = allLessons.map((lesson) => ({
    id: lesson.id,
    completed: completedLessonIds.has(lesson.id) && (requiredByLesson.get(lesson.id) ?? []).every((id) => passed.has(id)),
  }))
  const lessonCompleted = new Map(lessons.map((lesson) => [lesson.id, lesson.completed]))
  const styles = course.styles.map((style) => {
    const styleLessons = style.lessons.map((lesson) => lesson.id)
    const complete = styleLessons.every((lessonId) => lessonCompleted.get(lessonId)) && (requiredByStyle.get(style.id) ?? []).every((id) => passed.has(id))
    return { id: style.id, completed: complete }
  })
  const modules = course.modules.map((module) => {
    const completed = module.lessons.every((lesson) => lessonCompleted.get(lesson.id)) && (requiredByModule.get(module.id) ?? []).every((id) => passed.has(id))
    return { id: module.id, completed }
  })
  const allLessonsCompleted = lessons.length > 0 && lessons.every((lesson) => lesson.completed)
  const allStylesAndModulesCompleted = styles.every((style) => style.completed) && modules.every((module) => module.completed)
  const requiredCoursePassed = requiredCourse.every((id) => passed.has(id))

  return {
    totalLessons: lessons.length,
    completedLessons: lessons.filter((lesson) => lesson.completed).length,
    percentage: lessons.length === 0 ? 0 : Math.round((lessons.filter((lesson) => lesson.completed).length / lessons.length) * 100),
    lessons,
    styles,
    modules,
    finalAssessmentId: finalAssessment?.id ?? null,
    finalEligible: allLessonsCompleted && allStylesAndModulesCompleted && requiredCoursePassed,
  }
}

export async function markLessonCompleted(userId: string, lessonId: string) {
  const target = await resolveScopeTarget({ scope: LearningScope.LESSON, scopeId: lessonId })
  const required = await db.assessment.findMany({
    where: { scope: LearningScope.LESSON, lessonId, isRequired: true, publishedAt: { not: null } },
    select: { id: true },
  })
  const approved = await approvedAssessmentIds(userId, required.map((assessment) => assessment.id))
  if (!required.every((assessment) => approved.has(assessment.id))) {
    throw new LearningContentError('Debes aprobar todas las evaluaciones obligatorias de la lección.', 409, 'LESSON_REQUIREMENTS_PENDING')
  }
  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId },
    update: { completedAt: new Date() },
  })
  return getCourseLearningProgress(userId, target.courseId)
}

export async function getStudentAssessment(assessmentId: string, userId: string) {
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    include: { questions: { orderBy: { order: 'asc' } }, revalidations: { where: { userId }, select: { attemptsGranted: true } } },
  })
  if (!assessment || !assessment.publishedAt || assessment.publishedAt > new Date()) {
    throw new LearningContentError('La evaluación no está disponible.', 404, 'ASSESSMENT_NOT_AVAILABLE')
  }
  const target = await resolveScopeTarget({ scope: assessment.scope, scopeId: assessment[scopeParentKey[assessment.scope]]! })
  const attempts = await db.assessmentAttempt.findMany({
    where: { assessmentId, userId },
    orderBy: { attemptNumber: 'desc' },
    select: { id: true, attemptNumber: true, status: true, score: true, reviewNote: true, submittedAt: true },
  })
  const allowedAttempts = assessment.maxAttempts + assessment.revalidations.reduce((total, grant) => total + grant.attemptsGranted, 0)
  const latest = attempts[0] ?? null
  const progress = await getCourseLearningProgress(userId, target.courseId)
  let availableByScope = true
  if (assessment.scope === LearningScope.STYLE && assessment.styleId) {
    const lessons = await db.lesson.findMany({ where: { styleId: assessment.styleId }, select: { id: true } })
    const completed = new Map(progress.lessons.map((lesson) => [lesson.id, lesson.completed]))
    availableByScope = lessons.length > 0 && lessons.every((lesson) => completed.get(lesson.id))
  }
  if (assessment.scope === LearningScope.MODULE && assessment.moduleId) {
    const moduleLessons = await db.lesson.findMany({ where: { moduleId: assessment.moduleId }, select: { id: true } })
    const completed = new Map(progress.lessons.map((lesson) => [lesson.id, lesson.completed]))
    availableByScope = moduleLessons.length > 0 && moduleLessons.every((lesson) => completed.get(lesson.id))
  }
  if (assessment.isFinalExam) availableByScope = progress.finalEligible
  // A pending manual attempt must always be reviewed before a new submit.
  const waitingForReview = latest?.status === AssessmentAttemptStatus.PENDING_REVIEW
  const exhausted = attempts.length >= allowedAttempts && latest?.status === AssessmentAttemptStatus.NOT_PASSED
  const canSubmit = availableByScope && !waitingForReview && !exhausted && latest?.status !== AssessmentAttemptStatus.APPROVED

  return {
    assessment: {
      id: assessment.id,
      title: assessment.title,
      description: assessment.description,
      scope: assessment.scope,
      isRequired: assessment.isRequired,
      isFinalExam: assessment.isFinalExam,
      maxAttempts: assessment.maxAttempts,
      passingScore: assessment.passingScore,
      questions: assessment.questions.map((question) => ({
        id: question.id,
        type: question.type,
        title: question.title,
        description: question.description,
        order: question.order,
        required: question.required,
        options: question.options,
      })),
    },
    attempts,
    allowedAttempts,
    remainingAttempts: Math.max(0, allowedAttempts - attempts.length),
    canSubmit,
    waitingForReview,
    exhausted,
    unavailableReason: !availableByScope ? 'Completa primero los requisitos del contexto para habilitar esta evaluación.' : null,
  }
}

export async function submitAssessment(userId: string, assessmentId: string, answers: AssessmentAnswerInput[]) {
  const state = await getStudentAssessment(assessmentId, userId)
  if (!state.canSubmit) {
    throw new LearningContentError(
      state.exhausted ? 'Agotaste tus intentos. Comunícate con administración para solicitar una revalidación.' : 'Esta evaluación aún no admite otro intento.',
      409,
      state.exhausted ? 'ATTEMPTS_EXHAUSTED' : 'ASSESSMENT_LOCKED'
    )
  }
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    include: { questions: { orderBy: { order: 'asc' } } },
  })
  if (!assessment) throw new LearningContentError('La evaluación no existe.', 404, 'ASSESSMENT_NOT_FOUND')

  const answersByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]))
  for (const question of assessment.questions) {
    const answer = answersByQuestion.get(question.id)
    if (question.required && (!answer || (!answer.responseText?.trim() && !answer.fileUrl?.trim()))) {
      throw new LearningContentError('Responde todas las preguntas obligatorias.')
    }
    if (question.type === AssessmentQuestionType.MULTIPLE_CHOICE && answer?.responseText && !((question.options as string[] | null) ?? []).includes(answer.responseText)) {
      throw new LearningContentError('Una respuesta seleccionada no pertenece a las opciones de la pregunta.')
    }
  }

  const automatic = !requiresManualReview(assessment.questions.map((question) => question.type))
  const score = automatic ? calculateMultipleChoiceScore(assessment.questions, answersByQuestion) : null
  const status = automatic
    ? score! >= assessment.passingScore ? AssessmentAttemptStatus.APPROVED : AssessmentAttemptStatus.NOT_PASSED
    : AssessmentAttemptStatus.PENDING_REVIEW

  let attempt
  try {
    attempt = await db.assessmentAttempt.create({
      data: {
        assessmentId,
        userId,
        attemptNumber: state.attempts.length + 1,
        status,
        score,
        answers: {
          create: assessment.questions.flatMap((question) => {
            const answer = answersByQuestion.get(question.id)
            if (!answer) return []
            return [{
              questionId: question.id,
              responseText: answer.responseText?.trim() || null,
              fileUrl: answer.fileUrl?.trim() || null,
              fileMimeType: answer.fileMimeType?.trim() || null,
              isCorrect: automatic ? answer.responseText === question.correctAnswer : null,
            }]
          }),
        },
      },
      include: { assessment: { select: { scope: true, lessonId: true, courseId: true, isFinalExam: true } } },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new LearningContentError('Se registró otro intento al mismo tiempo. Actualiza la página e inténtalo de nuevo.', 409, 'ATTEMPT_CONFLICT')
    }
    throw error
  }
  if (status === AssessmentAttemptStatus.APPROVED) {
    await handleApprovedAttempt(userId, attempt.assessment)
  }
  return attempt
}

async function handleApprovedAttempt(
  userId: string,
  assessment: { scope: LearningScope; lessonId: string | null; courseId: string | null; isFinalExam: boolean }
) {
  if (assessment.scope === LearningScope.LESSON && assessment.lessonId) {
    await markLessonCompleted(userId, assessment.lessonId)
  }
  if (assessment.isFinalExam && assessment.courseId) {
    const progress = await getCourseLearningProgress(userId, assessment.courseId)
    if (!progress.finalEligible) {
      throw new LearningContentError('El examen final fue aprobado, pero aún faltan requisitos previos del curso.', 409, 'FINAL_PREREQUISITES_PENDING')
    }

    const course = await db.course.findUnique({ where: { id: assessment.courseId }, select: { certificateSlogan: true } })
    if (!normalizeCertificateSlogan(course?.certificateSlogan)) {
      throw new LearningContentError(
        'El curso todavía no tiene slogan de certificado, así que no se puede emitir. Completalo en la edición del curso y volvé a aprobar este intento.',
        409,
        'COURSE_CERTIFICATE_SLOGAN_MISSING'
      )
    }

    try {
      await generateAndSaveCertificate(userId, assessment.courseId)
    } catch (error) {
      console.error('Error issuing certificate during assessment review:', error)
      throw new LearningContentError(
        'No se pudo emitir el certificado, así que el intento sigue pendiente de corrección. Volvé a intentarlo.',
        502,
        'CERTIFICATE_ISSUE_FAILED'
      )
    }
  }
}

export async function reviewAssessmentAttempt(
  reviewerId: string,
  attemptId: string,
  input: { approved: boolean; reviewNote?: string }
) {
  const attempt = await db.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: { assessment: { select: { scope: true, lessonId: true, courseId: true, isFinalExam: true } } },
  })
  if (!attempt) throw new LearningContentError('El intento no existe.', 404, 'ATTEMPT_NOT_FOUND')
  if (attempt.status !== AssessmentAttemptStatus.PENDING_REVIEW) {
    throw new LearningContentError('Este intento ya fue corregido.', 409, 'ATTEMPT_ALREADY_REVIEWED')
  }
  const status = input.approved ? AssessmentAttemptStatus.APPROVED : AssessmentAttemptStatus.NOT_PASSED
  // Side effects run BEFORE the attempt is marked. The status guard above rejects
  // a second review, so marking first would strand the student on any failure —
  // approved, with no certificate and no way to retry. Certificate issuance and
  // lesson completion are both idempotent, so a failure after them is safe to retry.
  if (status === AssessmentAttemptStatus.APPROVED) await handleApprovedAttempt(attempt.userId, attempt.assessment)

  return db.assessmentAttempt.update({
    where: { id: attemptId },
    data: { status, reviewedById: reviewerId, reviewedAt: new Date(), reviewNote: input.reviewNote?.trim() || null },
  })
}

export async function grantAssessmentRevalidation(
  grantedById: string,
  assessmentId: string,
  userId: string,
  input: { attemptsGranted: number; reason?: string }
) {
  if (!Number.isInteger(input.attemptsGranted) || input.attemptsGranted < 1) {
    throw new LearningContentError('La revalidación debe conceder al menos un intento.')
  }
  const assessment = await db.assessment.findUnique({ where: { id: assessmentId }, select: { id: true, maxAttempts: true } })
  if (!assessment) throw new LearningContentError('La evaluación no existe.', 404, 'ASSESSMENT_NOT_FOUND')
  const [attempts, grants] = await Promise.all([
    db.assessmentAttempt.findMany({ where: { assessmentId, userId }, orderBy: { attemptNumber: 'desc' }, select: { status: true } }),
    db.assessmentRevalidation.aggregate({ where: { assessmentId, userId }, _sum: { attemptsGranted: true } }),
  ])
  const allowed = assessment.maxAttempts + (grants._sum.attemptsGranted ?? 0)
  if (attempts.length < allowed || attempts[0]?.status !== AssessmentAttemptStatus.NOT_PASSED) {
    throw new LearningContentError('Solo puedes revalidar una evaluación agotada y marcada como no aprobada.', 409, 'REVALIDATION_NOT_AVAILABLE')
  }
  return db.assessmentRevalidation.create({
    data: { assessmentId, userId, grantedById, attemptsGranted: input.attemptsGranted, reason: input.reason?.trim() || null },
  })
}

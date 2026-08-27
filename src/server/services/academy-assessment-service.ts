import {
  FinalExamAttemptStatus,
  FinalExamQuestionType,
  Prisma,
} from '@prisma/client'
import { db } from '@/lib/db'
import { generateAndSaveCertificate } from '@/server/services/certificate.service'

export type LessonTestQuestionInput = {
  title: string
  description?: string | null
  options: string[]
  correctAnswer: string
}

export type FinalExamQuestionInput = {
  type: FinalExamQuestionType
  title: string
  description?: string | null
  required?: boolean
  config?: Prisma.InputJsonValue | null
}

export type FinalExamAnswerInput = {
  questionId: string
  responseText?: string | null
  fileUrl?: string | null
  fileMimeType?: string | null
}

function toFinalExamQuestionCreateInput(
  question: FinalExamQuestionInput,
  order: number
): Prisma.FinalExamQuestionCreateWithoutFinalExamInput {
  return {
    type: question.type,
    title: question.title,
    description: question.description ?? null,
    required: question.required ?? true,
    order,
    ...(question.config === undefined
      ? {}
      : { config: question.config === null ? Prisma.JsonNull : question.config }),
  }
}

export class AcademyAssessmentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AcademyAssessmentError'
  }
}

const publicLessonTestSelect = {
  id: true,
  title: true,
  description: true,
  order: true,
  maxAttempts: true,
  passingScore: true,
  publishedAt: true,
  questions: {
    select: {
      id: true,
      title: true,
      description: true,
      order: true,
      options: true,
    },
    orderBy: { order: 'asc' as const },
  },
} satisfies Prisma.LessonTestSelect

function assessmentErrorFromUnknown(error: unknown): never {
  if (error instanceof AcademyAssessmentError) throw error
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new AcademyAssessmentError(
      'ATTEMPT_CONFLICT',
      'Se registró otro intento al mismo tiempo. Actualiza la página e inténtalo de nuevo.',
      409
    )
  }
  throw error
}

async function getLessonOrThrow(lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      module: { select: { courseId: true } },
    },
  })

  if (!lesson) {
    throw new AcademyAssessmentError('LESSON_NOT_FOUND', 'La lección no existe.', 404)
  }

  return lesson
}

async function getFinalExamOrThrow(courseId: string) {
  const finalExam = await db.finalExam.findUnique({
    where: { courseId },
    include: {
      questions: { orderBy: { order: 'asc' } },
    },
  })

  if (!finalExam) {
    throw new AcademyAssessmentError(
      'FINAL_EXAM_NOT_CONFIGURED',
      'Este curso aún no tiene un examen final configurado.',
      404
    )
  }

  return finalExam
}

export async function getCourseLessonProgress(userId: string, courseId: string) {
  const [totalLessons, completedLessons] = await Promise.all([
    db.lesson.count({ where: { module: { courseId } } }),
    db.lessonProgress.count({ where: { userId, lesson: { module: { courseId } } } }),
  ])

  return {
    totalLessons,
    completedLessons,
    percentage: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
    isComplete: totalLessons > 0 && completedLessons === totalLessons,
  }
}

async function getLessonTestGate(userId: string, lessonId: string) {
  const tests = await db.lessonTest.findMany({
    where: { lessonId, publishedAt: { lte: new Date() } },
    select: { id: true, title: true },
  })
  if (tests.length === 0) return { tests, pending: [] as typeof tests }

  const passed = await db.lessonTestSubmission.findMany({
    where: {
      userId,
      lessonTestId: { in: tests.map((test) => test.id) },
      isPassed: true,
    },
    select: { lessonTestId: true },
  })
  const passedIds = new Set(passed.map((submission) => submission.lessonTestId))
  return { tests, pending: tests.filter((test) => !passedIds.has(test.id)) }
}

export async function markLessonComplete(userId: string, lessonId: string) {
  const lesson = await getLessonOrThrow(lessonId)
  const existing = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  })

  // Completion is durable: a test added later never invalidates earned progress.
  if (existing) return { progress: existing, alreadyCompleted: true, courseId: lesson.module.courseId }

  const gate = await getLessonTestGate(userId, lessonId)
  if (gate.pending.length > 0) {
    throw new AcademyAssessmentError(
      'LESSON_TESTS_PENDING',
      'Debes aprobar todos los tests de la lección antes de completarla.',
      403,
      { pendingTests: gate.pending }
    )
  }

  const progress = await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: {},
    create: { userId, lessonId },
  })

  return { progress, alreadyCompleted: false, courseId: lesson.module.courseId }
}

export async function getStudentLessonTests(userId: string, lessonId: string) {
  await getLessonOrThrow(lessonId)
  const [tests, submissions, progress] = await Promise.all([
    db.lessonTest.findMany({
      where: { lessonId, publishedAt: { lte: new Date() } },
      select: publicLessonTestSelect,
      orderBy: { order: 'asc' },
    }),
    db.lessonTestSubmission.findMany({
      where: { userId, lessonTest: { lessonId, publishedAt: { lte: new Date() } } },
      select: {
        lessonTestId: true,
        attemptNumber: true,
        score: true,
        isPassed: true,
        submittedAt: true,
      },
      orderBy: { attemptNumber: 'desc' },
    }),
    db.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
      select: { completedAt: true },
    }),
  ])

  return {
    lessonCompletedAt: progress?.completedAt ?? null,
    tests: tests.map((test) => {
      const testSubmissions = submissions.filter((submission) => submission.lessonTestId === test.id)
      const passed = testSubmissions.some((submission) => submission.isPassed)
      const attemptsUsed = testSubmissions.length
      return {
        ...test,
        attemptsUsed,
        attemptsRemaining: Math.max(test.maxAttempts - attemptsUsed, 0),
        isPassed: passed,
        latestSubmission: testSubmissions[0] ?? null,
        canSubmit: !passed && attemptsUsed < test.maxAttempts,
      }
    }),
  }
}

export async function submitLessonTest(
  userId: string,
  lessonId: string,
  testId: string,
  answers: Record<string, string>
) {
  try {
    const result = await db.$transaction(async (transaction) => {
      const test = await transaction.lessonTest.findFirst({
        where: { id: testId, lessonId, publishedAt: { lte: new Date() } },
        include: { questions: { orderBy: { order: 'asc' } }, lesson: { select: { module: { select: { courseId: true } } } } },
      })
      if (!test) {
        throw new AcademyAssessmentError('LESSON_TEST_NOT_FOUND', 'El test no existe.', 404)
      }
      if (test.questions.length === 0) {
        throw new AcademyAssessmentError(
          'LESSON_TEST_HAS_NO_QUESTIONS',
          'Este test aún no tiene preguntas configuradas.',
          409
        )
      }

      const submissions = await transaction.lessonTestSubmission.findMany({
        where: { lessonTestId: testId, userId },
        select: { attemptNumber: true, isPassed: true },
      })
      if (submissions.some((submission) => submission.isPassed)) {
        throw new AcademyAssessmentError('LESSON_TEST_ALREADY_PASSED', 'Ya aprobaste este test.', 409)
      }
      if (submissions.length >= test.maxAttempts) {
        throw new AcademyAssessmentError(
          'LESSON_TEST_ATTEMPTS_EXHAUSTED',
          'Agotaste los intentos disponibles para este test.',
          403,
          { attemptsUsed: submissions.length, maxAttempts: test.maxAttempts }
        )
      }

      const scoredAnswers = test.questions.map((question) => {
        const answer = answers[question.id] ?? ''
        return { questionId: question.id, answer, isCorrect: answer === question.correctAnswer }
      })
      const correctCount = scoredAnswers.filter((answer) => answer.isCorrect).length
      const score = (correctCount / test.questions.length) * 100
      const isPassed = score >= test.passingScore
      const attemptNumber = submissions.length + 1

      const submission = await transaction.lessonTestSubmission.create({
        data: {
          lessonTestId: testId,
          userId,
          score,
          isPassed,
          attemptNumber,
          answers: { create: scoredAnswers },
        },
      })

      return {
        submission,
        correctCount,
        totalQuestions: test.questions.length,
        passingScore: test.passingScore,
        maxAttempts: test.maxAttempts,
        courseId: test.lesson.module.courseId,
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    let lessonCompletion = null
    if (result.submission.isPassed) {
      const gate = await getLessonTestGate(userId, lessonId)
      const existing = await db.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
      })
      if (!existing && gate.pending.length === 0) {
        lessonCompletion = await markLessonComplete(userId, lessonId)
      }
    }

    const attemptsRemaining = Math.max(result.maxAttempts - result.submission.attemptNumber, 0)
    return {
      ...result,
      attemptsRemaining,
      lessonCompletion,
      message: result.submission.isPassed
        ? 'Test aprobado.'
        : attemptsRemaining > 0
          ? 'Test no aprobado. Puedes intentar de nuevo.'
          : 'Test no aprobado. Agotaste los intentos disponibles.',
    }
  } catch (error) {
    assessmentErrorFromUnknown(error)
  }
}

export async function upsertLessonTest(
  lessonId: string,
  input: {
    id?: string
    title: string
    description?: string | null
    maxAttempts: number
    passingScore: number
    questions?: LessonTestQuestionInput[]
  }
) {
  await getLessonOrThrow(lessonId)

  if (input.id) {
    const existing = await db.lessonTest.findFirst({ where: { id: input.id, lessonId } })
    if (!existing) throw new AcademyAssessmentError('LESSON_TEST_NOT_FOUND', 'El test no existe.', 404)
    const submissionCount = await db.lessonTestSubmission.count({ where: { lessonTestId: input.id } })
    if (submissionCount > 0 && input.questions) {
      throw new AcademyAssessmentError(
        'LESSON_TEST_HAS_SUBMISSIONS',
        'No puedes reemplazar las preguntas de un test que ya tiene intentos.',
        409
      )
    }
    return db.lessonTest.update({
      where: { id: input.id },
      data: {
        title: input.title,
        description: input.description ?? null,
        maxAttempts: input.maxAttempts,
        passingScore: input.passingScore,
        ...(input.questions
          ? {
              questions: {
                deleteMany: {},
                create: input.questions.map((question, index) => ({ ...question, order: index })),
              },
            }
          : {}),
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    })
  }

  const last = await db.lessonTest.findFirst({ where: { lessonId }, orderBy: { order: 'desc' } })
  return db.lessonTest.create({
    data: {
      lessonId,
      title: input.title,
      description: input.description ?? null,
      maxAttempts: input.maxAttempts,
      passingScore: input.passingScore,
      order: (last?.order ?? -1) + 1,
      questions: input.questions
        ? { create: input.questions.map((question, index) => ({ ...question, order: index })) }
        : undefined,
    },
    include: { questions: { orderBy: { order: 'asc' } } },
  })
}

export async function deleteLessonTest(lessonId: string, testId: string) {
  const test = await db.lessonTest.findFirst({ where: { id: testId, lessonId } })
  if (!test) throw new AcademyAssessmentError('LESSON_TEST_NOT_FOUND', 'El test no existe.', 404)
  await db.lessonTest.delete({ where: { id: testId } })
}

async function getFinalExamAttemptState(userId: string, finalExamId: string, baseAttempts: number) {
  const [attempts, revalidations] = await Promise.all([
    db.finalExamAttempt.findMany({
      where: { finalExamId, userId },
      orderBy: { attemptNumber: 'desc' },
      select: { id: true, attemptNumber: true, status: true, reviewNote: true, reviewedAt: true, submittedAt: true },
    }),
    db.finalExamRevalidation.aggregate({
      where: { finalExamId, userId },
      _sum: { attemptsGranted: true },
    }),
  ])
  const attemptsAllowed = baseAttempts + (revalidations._sum.attemptsGranted ?? 0)
  const attemptsUsed = attempts.length
  const pendingAttempt = attempts.find((attempt) => attempt.status === FinalExamAttemptStatus.PENDING_REVIEW) ?? null
  const approvedAttempt = attempts.find((attempt) => attempt.status === FinalExamAttemptStatus.APPROVED) ?? null
  return {
    attempts,
    attemptsAllowed,
    attemptsUsed,
    attemptsRemaining: Math.max(attemptsAllowed - attemptsUsed, 0),
    pendingAttempt,
    approvedAttempt,
  }
}

export async function getStudentFinalExam(userId: string, courseId: string) {
  const [progress, finalExam] = await Promise.all([
    getCourseLessonProgress(userId, courseId),
    db.finalExam.findUnique({
      where: { courseId },
      select: {
        id: true,
        title: true,
        description: true,
        maxAttempts: true,
        questions: {
          select: { id: true, type: true, title: true, description: true, required: true, order: true, config: true },
          orderBy: { order: 'asc' },
        },
      },
    }),
  ])
  if (!finalExam) return { finalExam: null, progress, canSubmit: false, reason: 'FINAL_EXAM_NOT_CONFIGURED' }

  const state = await getFinalExamAttemptState(userId, finalExam.id, finalExam.maxAttempts)
  const reason = !progress.isComplete
    ? 'LESSONS_INCOMPLETE'
    : state.approvedAttempt
      ? 'ALREADY_APPROVED'
      : state.pendingAttempt
        ? 'PENDING_REVIEW'
        : state.attemptsRemaining === 0
          ? 'CONTACT_ADMINISTRATION'
          : null

  return {
    finalExam,
    progress,
    ...state,
    canSubmit: reason === null && finalExam.questions.length > 0,
    reason,
  }
}

function validateFinalExamAnswers(
  questions: Array<{ id: string; type: FinalExamQuestionType; required: boolean }>,
  answers: FinalExamAnswerInput[]
) {
  const byQuestion = new Map(answers.map((answer) => [answer.questionId, answer]))
  return questions.map((question) => {
    const answer = byQuestion.get(question.id)
    const responseText = answer?.responseText?.trim() || null
    const fileUrl = answer?.fileUrl?.trim() || null
    const fileMimeType = answer?.fileMimeType?.trim() || null
    const hasResponse = question.type === FinalExamQuestionType.WRITTEN ? !!responseText : !!fileUrl
    if (question.required && !hasResponse) {
      throw new AcademyAssessmentError(
        'FINAL_EXAM_ANSWER_REQUIRED',
        'Debes responder todas las preguntas obligatorias.',
        400,
        { questionId: question.id }
      )
    }
    if (fileMimeType) {
      const expectedPrefix = question.type === FinalExamQuestionType.PHOTO ? 'image/' : question.type === FinalExamQuestionType.VIDEO ? 'video/' : null
      if (expectedPrefix && !fileMimeType.startsWith(expectedPrefix)) {
        throw new AcademyAssessmentError('FINAL_EXAM_FILE_TYPE_INVALID', 'El archivo no corresponde al tipo de evidencia solicitado.', 400, { questionId: question.id })
      }
    }
    return { questionId: question.id, responseText, fileUrl, fileMimeType }
  })
}

export async function submitFinalExam(userId: string, courseId: string, answers: FinalExamAnswerInput[]) {
  try {
    const availability = await getStudentFinalExam(userId, courseId)
    if (!availability.finalExam) {
      throw new AcademyAssessmentError('FINAL_EXAM_NOT_CONFIGURED', 'Este curso aún no tiene un examen final configurado.', 404)
    }
    if (!availability.canSubmit) {
      const messageByReason: Record<string, string> = {
        LESSONS_INCOMPLETE: 'Debes completar todas las lecciones antes de presentar el examen final.',
        PENDING_REVIEW: 'Tu último intento está pendiente de corrección administrativa.',
        CONTACT_ADMINISTRATION: 'Agotaste todos los intentos. Comunícate con administración para solicitar una revalidación.',
        ALREADY_APPROVED: 'Ya aprobaste el examen final.',
      }
      throw new AcademyAssessmentError(
        availability.reason ?? 'FINAL_EXAM_NOT_AVAILABLE',
        messageByReason[availability.reason ?? ''] ?? 'El examen final no está disponible.',
        403
      )
    }

    const preparedAnswers = validateFinalExamAnswers(availability.finalExam.questions, answers)
    const attempt = await db.finalExamAttempt.create({
      data: {
        finalExamId: availability.finalExam.id,
        userId,
        attemptNumber: availability.attemptsUsed + 1,
        answers: { create: preparedAnswers },
      },
      include: { answers: true },
    })
    return attempt
  } catch (error) {
    assessmentErrorFromUnknown(error)
  }
}

export async function upsertFinalExam(
  courseId: string,
  input: { title: string; description?: string | null; maxAttempts: number; questions?: FinalExamQuestionInput[] }
) {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true } })
  if (!course) throw new AcademyAssessmentError('COURSE_NOT_FOUND', 'El curso no existe.', 404)

  const existing = await db.finalExam.findUnique({ where: { courseId } })
  if (existing) {
    const attemptCount = await db.finalExamAttempt.count({ where: { finalExamId: existing.id } })
    if (attemptCount > 0 && input.questions) {
      throw new AcademyAssessmentError('FINAL_EXAM_HAS_ATTEMPTS', 'No puedes reemplazar las preguntas de un examen que ya tiene intentos.', 409)
    }
    return db.finalExam.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        description: input.description ?? null,
        maxAttempts: input.maxAttempts,
        ...(input.questions
          ? { questions: { deleteMany: {}, create: input.questions.map(toFinalExamQuestionCreateInput) } }
          : {}),
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    })
  }

  return db.finalExam.create({
    data: {
      courseId,
      title: input.title,
      description: input.description ?? null,
      maxAttempts: input.maxAttempts,
      questions: input.questions
        ? { create: input.questions.map(toFinalExamQuestionCreateInput) }
        : undefined,
    },
    include: { questions: { orderBy: { order: 'asc' } } },
  })
}

export async function getAdminFinalExam(courseId: string) {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true } })
  if (!course) throw new AcademyAssessmentError('COURSE_NOT_FOUND', 'El curso no existe.', 404)
  return db.finalExam.findUnique({
    where: { courseId },
    include: {
      questions: { orderBy: { order: 'asc' } },
      attempts: {
        orderBy: { submittedAt: 'desc' },
        include: { student: { select: { id: true, name: true, email: true } }, answers: true },
      },
    },
  })
}

export async function reviewFinalExamAttempt(
  reviewerId: string,
  courseId: string,
  attemptId: string,
  status: 'APPROVED' | 'NOT_PASSED',
  reviewNote?: string | null
) {
  const attempt = await db.finalExamAttempt.findFirst({
    where: { id: attemptId, finalExam: { courseId } },
    select: { id: true, userId: true, finalExamId: true, status: true },
  })
  if (!attempt) throw new AcademyAssessmentError('FINAL_EXAM_ATTEMPT_NOT_FOUND', 'El intento no existe.', 404)
  if (attempt.status !== FinalExamAttemptStatus.PENDING_REVIEW) {
    throw new AcademyAssessmentError('FINAL_EXAM_ATTEMPT_ALREADY_REVIEWED', 'Este intento ya fue corregido.', 409)
  }

  const updated = await db.finalExamAttempt.update({
    where: { id: attempt.id },
    data: { status, reviewNote: reviewNote?.trim() || null, reviewedAt: new Date(), reviewedById: reviewerId },
  })
  if (status === FinalExamAttemptStatus.APPROVED) {
    await generateAndSaveCertificate(attempt.userId, courseId)
  }
  return updated
}

export async function grantFinalExamRevalidation(
  grantedById: string,
  courseId: string,
  userId: string,
  attemptsGranted: number,
  reason?: string | null
) {
  const finalExam = await getFinalExamOrThrow(courseId)
  const state = await getFinalExamAttemptState(userId, finalExam.id, finalExam.maxAttempts)
  const latestAttempt = state.attempts[0]
  if (
    state.attemptsUsed < state.attemptsAllowed ||
    !latestAttempt ||
    latestAttempt.status !== FinalExamAttemptStatus.NOT_PASSED
  ) {
    throw new AcademyAssessmentError(
      'REVALIDATION_NOT_AVAILABLE',
      'Solo puedes habilitar intentos después de que la persona haya agotado los disponibles y el último intento haya sido marcado como no aprobado.',
      409
    )
  }
  return db.finalExamRevalidation.create({
    data: { finalExamId: finalExam.id, userId, grantedById, attemptsGranted, reason: reason?.trim() || null },
  })
}

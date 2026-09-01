/**
 * Migrates LessonTest records to Assessment (scope LESSON).
 *
 *   npx tsx scripts/migrate-lesson-tests-to-assessments.mts          # dry run
 *   npx tsx scripts/migrate-lesson-tests-to-assessments.mts --apply
 *
 * Assessment is a strict superset of LessonTest: same passing score, attempts
 * and auto-graded multiple choice, plus revalidation and the written/photo/video
 * question types. LessonTest has no revalidation at all, so a student who runs
 * out of attempts is stuck with no way back.
 *
 * Nothing is deleted. The LessonTest rows stay untouched so this can be checked
 * — and reversed — before anyone drops the old model.
 */
import { db } from '../src/lib/db'

const apply = process.argv.includes('--apply')

const tests = await db.lessonTest.findMany({
  include: { questions: { orderBy: { order: 'asc' } }, submissions: true, lesson: { select: { title: true } } },
  orderBy: { order: 'asc' },
})

if (tests.length === 0) {
  console.log('No hay LessonTest para migrar.')
  await db.$disconnect()
  process.exit(0)
}

console.log(`${apply ? 'MIGRANDO' : 'SIMULACION (sin --apply no se escribe nada)'}: ${tests.length} test(s)\n`)

let migrated = 0
let skipped = 0

for (const test of tests) {
  // Idempotent: a second run must not duplicate what a first run created.
  const already = await db.assessment.findFirst({
    where: { scope: 'LESSON', lessonId: test.lessonId, title: test.title },
    select: { id: true },
  })
  if (already) {
    console.log(`  OMITIDO  "${test.title}" (ya existe como Assessment ${already.id})`)
    skipped += 1
    continue
  }

  console.log(`  ${test.lesson.title} > "${test.title}"`)
  console.log(`      ${test.questions.length} pregunta(s) · nota minima ${test.passingScore}% · ${test.maxAttempts} intento(s) · ${test.submissions.length} entrega(s)`)

  if (!apply) continue

  const created = await db.$transaction(async (tx) => {
    const assessment = await tx.assessment.create({
      data: {
        scope: 'LESSON',
        lessonId: test.lessonId,
        title: test.title,
        description: test.description,
        order: test.order,
        // Lesson tests always gated the lesson, so they carry over as required.
        isRequired: true,
        isFinalExam: false,
        maxAttempts: test.maxAttempts,
        passingScore: test.passingScore,
        publishedAt: test.publishedAt,
        questions: {
          create: test.questions.map((question, index) => ({
            type: 'MULTIPLE_CHOICE' as const,
            title: question.title,
            description: question.description,
            order: question.order ?? index,
            required: true,
            options: question.options ?? [],
            correctAnswer: question.correctAnswer,
          })),
        },
      },
      select: { id: true },
    })

    // Submissions become attempts so nobody loses a passed test or an attempt
    // they already burned.
    for (const submission of test.submissions) {
      await tx.assessmentAttempt.create({
        data: {
          assessmentId: assessment.id,
          userId: submission.userId,
          attemptNumber: submission.attemptNumber,
          status: submission.isPassed ? 'APPROVED' : 'NOT_PASSED',
          score: submission.score,
          submittedAt: submission.submittedAt,
        },
      })
    }

    return assessment.id
  })

  console.log(`      -> Assessment ${created}`)
  migrated += 1
}

console.log(`\n${apply ? 'Migrados' : 'Se migrarian'}: ${migrated} · omitidos: ${skipped}`)
if (!apply) console.log('Volve a ejecutarlo con --apply para escribir.')
console.log('Los LessonTest originales NO se tocaron.')

await db.$disconnect()

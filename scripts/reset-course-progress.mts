/**
 * Clears a student's progress in a course so the flow can be tested again.
 *
 *   npx tsx scripts/reset-course-progress.mts <email> <courseId>
 *   npx tsx scripts/reset-course-progress.mts <email> <courseId> --module <moduleId>
 *
 * Removes LessonProgress and the legacy ModuleProgress rows, the lesson-test
 * submissions that gate completion, and any pending final exam attempt.
 * Certificates are left alone: deleting an issued one is not a test reset.
 */
import { db } from '../src/lib/db'

const args = process.argv.slice(2)
const [email, courseId] = args
const moduleIndex = args.indexOf('--module')
const onlyModuleId = moduleIndex >= 0 ? args[moduleIndex + 1] : null

if (!email || !courseId) {
  console.error('Uso: npx tsx scripts/reset-course-progress.mts <email> <courseId> [--module <moduleId>]')
  process.exit(1)
}

const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() }, select: { id: true, email: true } })
if (!user) {
  console.error(`No existe ninguna cuenta con el correo ${email}.`)
  process.exit(1)
}

const lessons = await db.lesson.findMany({
  where: { courseId, ...(onlyModuleId ? { moduleId: onlyModuleId } : {}) },
  select: { id: true, title: true },
})
if (lessons.length === 0) {
  console.error('No se encontraron lecciones para ese curso' + (onlyModuleId ? ' y módulo.' : '.'))
  process.exit(1)
}
const lessonIds = lessons.map((lesson) => lesson.id)

const progress = await db.lessonProgress.deleteMany({ where: { userId: user.id, lessonId: { in: lessonIds } } })
const submissions = await db.lessonTestSubmission.deleteMany({
  where: { userId: user.id, lessonTest: { lessonId: { in: lessonIds } } },
})
const modules = await db.moduleProgress.deleteMany({
  where: { userId: user.id, module: { courseId, ...(onlyModuleId ? { id: onlyModuleId } : {}) } },
})

// Only pending attempts: a reviewed one is a record of what actually happened.
const attempts = onlyModuleId
  ? { count: 0 }
  : await db.finalExamAttempt.deleteMany({
      where: { userId: user.id, status: 'PENDING_REVIEW', finalExam: { courseId } },
    })

console.log(`Progreso reiniciado para ${user.email}${onlyModuleId ? ' (solo ese módulo)' : ''}:`)
console.log(`  lecciones alcanzadas      : ${lessons.length}`)
console.log(`  progreso de lección       : ${progress.count} fila(s)`)
console.log(`  entregas de test          : ${submissions.count}`)
console.log(`  progreso de módulo legacy : ${modules.count}`)
console.log(`  intentos de examen final  : ${attempts.count} (solo los pendientes)`)

await db.$disconnect()

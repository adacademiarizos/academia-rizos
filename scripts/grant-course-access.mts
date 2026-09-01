/**
 * Grants a user access to a course without going through Stripe.
 *
 * There is no admin UI for this, and buying locally would need the Stripe CLI
 * forwarding webhooks. For local testing this writes the same CourseAccess row
 * the webhook would create.
 *
 *   npx tsx scripts/grant-course-access.mts <email> [courseId]
 *
 * With no courseId it lists the courses so you can pick one.
 */
import { db } from '../src/lib/db'

const [email, courseId] = process.argv.slice(2)

if (!email) {
  console.error('Uso: npx tsx scripts/grant-course-access.mts <email> [courseId]')
  process.exit(1)
}

const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() }, select: { id: true, email: true, name: true } })
if (!user) {
  console.error(`No existe ninguna cuenta con el correo ${email}.`)
  console.error('Registrate primero en http://localhost:3000/register')
  process.exit(1)
}

if (!courseId) {
  const courses = await db.course.findMany({ select: { id: true, title: true, isActive: true }, orderBy: { createdAt: 'desc' } })
  console.log(`Cuenta encontrada: ${user.name ?? user.email}\n`)
  console.log('Cursos disponibles:\n')
  for (const course of courses) {
    console.log(`  ${course.id}  ${course.isActive ? '[activo]  ' : '[inactivo]'}  ${course.title}`)
  }
  console.log(`\nVolvé a ejecutarlo con el id:\n  npx tsx scripts/grant-course-access.mts ${email} <courseId>`)
  await db.$disconnect()
  process.exit(0)
}

const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } })
if (!course) {
  console.error(`No existe el curso ${courseId}.`)
  process.exit(1)
}

// accessUntil null = de por vida; revokedAt null = acceso vigente
const access = await db.courseAccess.upsert({
  where: { userId_courseId: { userId: user.id, courseId: course.id } },
  update: { accessUntil: null, revokedAt: null },
  create: { userId: user.id, courseId: course.id, accessUntil: null },
})

console.log(`Acceso concedido.`)
console.log(`  alumna: ${user.name ?? user.email}`)
console.log(`  curso : ${course.title}`)
console.log(`  vence : nunca (acceso de por vida)`)
console.log(`\nAbrí: http://localhost:3000/learn/${course.id}`)
void access

await db.$disconnect()

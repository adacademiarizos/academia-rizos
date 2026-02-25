import { db } from '@/lib/db'
import { generateCertificatePdf } from '@/lib/pdf'
import { uploadFile } from '@/lib/storage'
import { sendCertificateEmail } from '@/lib/mail'

function generateCertCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `CERT-${timestamp}-${random}`
}

/**
 * Generate, upload, and save a certificate for a user/course.
 * Idempotent: if a valid certificate already exists for this user+course,
 * returns it without generating a new one.
 */
export async function generateAndSaveCertificate(
  userId: string,
  courseId: string
) {
  // Idempotency check
  const existing = await db.certificate.findFirst({
    where: { userId, courseId, valid: true },
  })
  if (existing) return existing

  // Fetch user and course data
  const [user, course] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    db.course.findUnique({ where: { id: courseId }, select: { title: true } }),
  ])

  if (!user || !course) {
    throw new Error('User or course not found')
  }

  const code = generateCertCode()
  const issuedAt = new Date()

  // Generate PDF
  const pdfBuffer = await generateCertificatePdf({
    userName: user.name ?? user.email ?? 'Estudiante',
    courseName: course.title,
    code,
    issuedAt,
  })

  // Upload to R2
  const pdfUrl = await uploadFile(
    `certificates/${code}.pdf`,
    pdfBuffer,
    'application/pdf'
  )

  // Save to DB
  const certificate = await db.certificate.create({
    data: {
      code,
      courseId,
      userId,
      issuedAt,
      pdfUrl,
      valid: true,
    },
  })

  // Record activity (non-critical)
  await db.userActivity.create({
    data: {
      userId,
      type: 'EXAM_PASSED',
      courseId,
      metadata: { certificateCode: code },
    },
  }).catch(() => {})

  // Send congratulations email (non-critical)
  if (user.email) {
    await sendCertificateEmail({
      to: user.email,
      studentName: user.name ?? 'Estudiante',
      courseName: course.title,
      certificateCode: code,
      pdfUrl,
    }).catch(() => {})
  }

  return certificate
}

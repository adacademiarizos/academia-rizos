import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'
import { normalizeCertificateSlogan } from '@/validators/course.schema'
import { generateAndSaveCertificate } from '@/server/services/certificate.service'

export const maxDuration = 60;

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  })
  if (!user || user.role !== 'ADMIN') return null
  return user
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const cert = await db.certificate.findUnique({
      where: { id },
      select: { id: true, userId: true, courseId: true, valid: true, pdfUrl: true },
    })

    if (!cert) {
      return NextResponse.json({ success: false, error: 'Certificate not found' }, { status: 404 })
    }

    // Only allow approving a pending certificate (valid=false, no PDF)
    if (cert.valid || cert.pdfUrl) {
      return NextResponse.json(
        { success: false, error: 'This certificate is not pending approval' },
        { status: 400 }
      )
    }

    const course = await db.course.findUnique({
      where: { id: cert.courseId },
      select: { certificateSlogan: true },
    })
    if (!normalizeCertificateSlogan(course?.certificateSlogan)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'El curso todavía no tiene slogan de certificado, así que no se puede emitir. Completalo en la edición del curso y volvé a aprobar.',
        },
        { status: 409 }
      )
    }

    // Generate first, delete the placeholder only once the real certificate
    // exists. Deleting first destroyed the pending record whenever generation
    // failed, leaving nothing to retry. The placeholder has valid=false, so it
    // never satisfies the idempotency check inside generateAndSaveCertificate.
    const issued = await generateAndSaveCertificate(cert.userId, cert.courseId)
    await db.certificate.delete({ where: { id } })

    return NextResponse.json({ success: true, data: issued })
  } catch (error) {
    console.error('Certificate approval failed:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo emitir el certificado. El pendiente sigue disponible para reintentar.' },
      { status: 502 }
    )
  }
}

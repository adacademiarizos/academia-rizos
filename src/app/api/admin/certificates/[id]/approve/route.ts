import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { generateAndSaveCertificate } from '@/server/services/certificate.service'
import { NotificationService } from '@/server/services/notification-service'

export const maxDuration = 60;

async function requireAdmin() {
  const session = await getServerSession()
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

    // Delete the pending placeholder and generate the real certificate
    await db.certificate.delete({ where: { id } })
    const issued = await generateAndSaveCertificate(cert.userId, cert.courseId)

    // Notify the student
    await NotificationService.triggerOnCertificateIssued(cert.userId, cert.courseId)

    return NextResponse.json({ success: true, data: issued })
  } catch (error) {
    console.error('Certificate approval failed:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to approve certificate' },
      { status: 500 }
    )
  }
}

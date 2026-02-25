import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { db } from '@/lib/db'
import { NotificationService } from '@/server/services/notification-service'

const PatchSchema = z.object({
  valid: z.boolean(),
})

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { valid } = PatchSchema.parse(body)

    const certificate = await db.certificate.update({
      where: { id },
      data: { valid },
    })

    // Notify student when certificate is revoked
    if (!valid) {
      await NotificationService.triggerOnCertificateRevoked(certificate.userId, certificate.courseId)
    }

    return NextResponse.json({ success: true, data: certificate })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to update certificate' }, { status: 500 })
  }
}

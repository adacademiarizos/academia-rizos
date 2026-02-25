import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { courseId } = await params

    // Verify student has access to this course
    const access = await db.courseAccess.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
    })
    if (!access) {
      return NextResponse.json({ success: false, error: 'No access' }, { status: 403 })
    }

    // Return the valid issued certificate (pdfUrl present + valid)
    const certificate = await db.certificate.findFirst({
      where: { userId: user.id, courseId, valid: true, pdfUrl: { not: null } },
      select: { id: true, code: true, pdfUrl: true, issuedAt: true },
    })

    return NextResponse.json({ success: true, data: certificate ?? null })
  } catch {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

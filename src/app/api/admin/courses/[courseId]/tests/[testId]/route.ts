import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { db } from '@/lib/db'

const UpdateTestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  order: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
  isFinalExam: z.boolean().optional(),
  maxAttempts: z.number().int().min(0).optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
})

async function requireAdmin() {
  const session = await getServerSession()
  if (!session?.user?.email) return null
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true } })
  if (!user || user.role !== 'ADMIN') return null
  return user
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; testId: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { courseId, testId } = await params

    const test = await db.courseTest.findUnique({
      where: { id: testId },
      include: { questions: { orderBy: { order: 'asc' } } },
    })

    if (!test || test.courseId !== courseId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: test })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch test' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; testId: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { courseId, testId } = await params
    const body = await req.json()
    const data = UpdateTestSchema.parse(body)

    const existing = await db.courseTest.findUnique({ where: { id: testId } })
    if (!existing || existing.courseId !== courseId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    const test = await db.courseTest.update({ where: { id: testId }, data })

    return NextResponse.json({ success: true, data: test })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to update test' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; testId: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { courseId, testId } = await params

    const existing = await db.courseTest.findUnique({ where: { id: testId } })
    if (!existing || existing.courseId !== courseId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    await db.courseTest.delete({ where: { id: testId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete test' }, { status: 500 })
  }
}

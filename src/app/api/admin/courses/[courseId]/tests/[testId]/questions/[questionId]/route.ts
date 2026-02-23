import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { db } from '@/lib/db'

const UpdateQuestionSchema = z.object({
  type: z.enum(['MULTIPLE_CHOICE', 'WRITTEN', 'FILE_UPLOAD']).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  order: z.number().int().min(0).optional(),
  config: z.record(z.any()).optional(),
})

async function requireAdmin() {
  const session = await getServerSession()
  if (!session?.user?.email) return null
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true } })
  if (!user || user.role !== 'ADMIN') return null
  return user
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; testId: string; questionId: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { courseId, testId, questionId } = await params

    const test = await db.courseTest.findUnique({ where: { id: testId }, select: { courseId: true } })
    if (!test || test.courseId !== courseId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    const existing = await db.question.findUnique({ where: { id: questionId } })
    if (!existing || existing.courseTestId !== testId) {
      return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 })
    }

    const body = await req.json()
    const data = UpdateQuestionSchema.parse(body)

    const question = await db.question.update({ where: { id: questionId }, data })

    return NextResponse.json({ success: true, data: question })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'Failed to update question' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ courseId: string; testId: string; questionId: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { courseId, testId, questionId } = await params

    const test = await db.courseTest.findUnique({ where: { id: testId }, select: { courseId: true } })
    if (!test || test.courseId !== courseId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    const existing = await db.question.findUnique({ where: { id: questionId } })
    if (!existing || existing.courseTestId !== testId) {
      return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 })
    }

    await db.question.delete({ where: { id: questionId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete question' }, { status: 500 })
  }
}

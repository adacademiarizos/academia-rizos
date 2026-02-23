import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { db } from '@/lib/db'

const CreateQuestionSchema = z.object({
  type: z.enum(['MULTIPLE_CHOICE', 'WRITTEN', 'FILE_UPLOAD']),
  title: z.string().min(1),
  description: z.string().optional(),
  order: z.number().int().min(0).optional(),
  config: z.record(z.any()).default({}),
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

    const test = await db.courseTest.findUnique({ where: { id: testId }, select: { courseId: true } })
    if (!test || test.courseId !== courseId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    const questions = await db.question.findMany({
      where: { courseTestId: testId },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({ success: true, data: questions })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch questions' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string; testId: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { courseId, testId } = await params

    const test = await db.courseTest.findUnique({ where: { id: testId }, select: { courseId: true } })
    if (!test || test.courseId !== courseId) {
      return NextResponse.json({ success: false, error: 'Test not found' }, { status: 404 })
    }

    const body = await req.json()
    const data = CreateQuestionSchema.parse(body)

    const order = data.order ?? await db.question.count({ where: { courseTestId: testId } })

    const question = await db.question.create({
      data: {
        courseTestId: testId,
        type: data.type,
        title: data.title,
        description: data.description,
        order,
        config: data.config,
      },
    })

    return NextResponse.json({ success: true, data: question }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors }, { status: 400 })
    }
    console.error('Error creating question:', error)
    return NextResponse.json({ success: false, error: 'Failed to create question' }, { status: 500 })
  }
}

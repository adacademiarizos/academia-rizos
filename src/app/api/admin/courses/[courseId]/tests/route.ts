import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { db } from '@/lib/db'

const CreateTestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  order: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
  isFinalExam: z.boolean().optional(),
  maxAttempts: z.number().int().min(0).default(1),
  passingScore: z.number().int().min(0).max(100).default(70),
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
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { courseId } = await params

    const tests = await db.courseTest.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { questions: true, submissions: true } },
      },
    })

    return NextResponse.json({ success: true, data: tests })
  } catch (error) {
    console.error('Error fetching course tests:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch tests' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { courseId } = await params
    const body = await req.json()
    const data = CreateTestSchema.parse(body)

    // Auto-assign order if not provided
    const order = data.order ?? await db.courseTest.count({ where: { courseId } })

    const test = await db.courseTest.create({
      data: {
        courseId,
        title: data.title,
        description: data.description,
        order,
        isRequired: data.isRequired ?? false,
        isFinalExam: data.isFinalExam ?? false,
        maxAttempts: data.maxAttempts,
        passingScore: data.passingScore,
      },
    })

    return NextResponse.json({ success: true, data: test }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors }, { status: 400 })
    }
    console.error('Error creating course test:', error)
    return NextResponse.json({ success: false, error: 'Failed to create test' }, { status: 500 })
  }
}

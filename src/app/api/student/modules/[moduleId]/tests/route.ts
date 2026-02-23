/**
 * GET /api/student/modules/[moduleId]/tests
 * Returns all tests for a module (for students)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const { moduleId } = await params

    const tests = await db.moduleTest.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        maxAttempts: true,
        passingScore: true,
        isRequired: true,
        _count: { select: { questions: true } },
      },
    })

    return NextResponse.json({ success: true, data: tests })
  } catch (error) {
    console.error('Error fetching module tests:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tests',
      },
      { status: 500 }
    )
  }
}

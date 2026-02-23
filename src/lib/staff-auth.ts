import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'

/**
 * Check if user is authenticated and has STAFF or ADMIN role
 * Returns { authorized: true, user } if authorized, otherwise returns NextResponse with error
 */
export async function checkStaffAuth() {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return {
        authorized: false as const,
        response: NextResponse.json(
          { success: false, error: 'Unauthorized - please sign in' },
          { status: 401 }
        ),
      }
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true, name: true, email: true },
    })

    if (!user) {
      return {
        authorized: false as const,
        response: NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        ),
      }
    }

    if (user.role !== 'STAFF' && user.role !== 'ADMIN') {
      return {
        authorized: false as const,
        response: NextResponse.json(
          { success: false, error: 'Staff access required' },
          { status: 403 }
        ),
      }
    }

    return {
      authorized: true as const,
      user,
    }
  } catch (error) {
    return {
      authorized: false as const,
      response: NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Authentication failed',
        },
        { status: 500 }
      ),
    }
  }
}

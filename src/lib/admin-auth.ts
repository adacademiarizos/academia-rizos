/**
 * Admin authentication utilities
 * Provides helper functions to protect admin API endpoints
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'

/**
 * Check if user is authenticated and has ADMIN role
 * Returns { authorized: true } if authorized, otherwise returns NextResponse with error
 */
export async function checkAdminAuth() {
  try {
    // Check authentication
    const session = await getServerSession()
    if (!session?.user?.email) {
      return {
        authorized: false,
        response: NextResponse.json(
          { success: false, error: 'Unauthorized - please sign in' },
          { status: 401 }
        ),
      }
    }

    // Check admin role
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    })

    if (!user) {
      return {
        authorized: false,
        response: NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        ),
      }
    }

    if (user.role !== 'ADMIN') {
      return {
        authorized: false,
        response: NextResponse.json(
          { success: false, error: 'Admin access required' },
          { status: 403 }
        ),
      }
    }

    // All checks passed
    return {
      authorized: true,
      user,
    }
  } catch (error) {
    return {
      authorized: false,
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

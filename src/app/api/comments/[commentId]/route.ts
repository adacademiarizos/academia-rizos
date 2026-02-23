/**
 * DELETE /api/comments/[commentId]
 * Delete a comment (owner only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { CommunityService } from '@/server/services/community-service'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params

    if (!commentId) {
      return NextResponse.json(
        { success: false, error: 'Comment ID is required' },
        { status: 400 }
      )
    }

    // Check authentication
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - please sign in' },
        { status: 401 }
      )
    }

    // Get user from database
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

    // Delete comment
    await CommunityService.deleteComment(commentId, user.id)

    return NextResponse.json({
      success: true,
      data: { id: commentId },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete comment'

    // Check if it's an authorization error
    if (message.includes('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 403 }
      )
    }

    // Check if it's a not found error
    if (message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 404 }
      )
    }

    console.error('Error deleting comment:', error)
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/users/[userId]/profile
 * Get public user profile information
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { AnalyticsService } from '@/server/services/analytics-service'
import { AchievementService } from '@/server/services/achievement-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    // Fetch user public info
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        image: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Get user statistics
    const stats = await AnalyticsService.getUserStats(userId)
    const courseProgress = await AnalyticsService.getCoursesProgress(userId)
    const achievements = await AchievementService.getUserAchievements(userId)

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        image: user.image,
        createdAt: user.createdAt,
        stats: {
          coursesEnrolled: stats.coursesEnrolled,
          modulesCompleted: stats.modulesCompleted,
          testsPassed: stats.testsPassed,
        },
        courseProgress: courseProgress.map((c) => ({
          courseId: c.courseId,
          courseTitle: c.courseTitle,
          percentComplete: c.percentComplete,
          status: c.status,
        })),
        achievements: achievements.map((a) => ({
          id: a.id,
          type: a.type,
          name: a.name,
          description: a.description,
          earnedAt: a.earnedAt,
        })),
      },
    })
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch profile',
      },
      { status: 500 }
    )
  }
}

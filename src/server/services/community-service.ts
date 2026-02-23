/**
 * CommunityService - Centralized service for community interactions
 * Handles: Likes, Comments, Chat
 */

import { db } from '@/lib/db'

interface CommentWithUser {
  id: string
  body: string
  createdAt: Date
  targetType: 'COURSE' | 'MODULE'
  courseId: string | null
  moduleId: string | null
  userId: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface ChatMessageWithUser {
  id: string
  body: string
  imageUrl: string | null
  createdAt: Date
  roomId: string
  userId: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

export class CommunityService {
  // ============ LIKES ============

  static async toggleLike(
    userId: string,
    targetType: 'COURSE' | 'MODULE',
    courseId?: string,
    moduleId?: string
  ): Promise<{ liked: boolean }> {
    // Validate that either courseId or moduleId is provided
    if (!courseId && !moduleId) {
      throw new Error('Either courseId or moduleId must be provided')
    }

    try {
      // Check if like already exists using findFirst (more flexible than findUnique)
      const existingLike = await db.like.findFirst({
        where: {
          userId,
          targetType,
          courseId: courseId ?? null,
          moduleId: moduleId ?? null,
        },
      })

      if (existingLike) {
        // Delete the like (unlike)
        await db.like.delete({
          where: { id: existingLike.id },
        })
        return { liked: false }
      } else {
        // Create the like
        await db.like.create({
          data: {
            userId,
            targetType,
            courseId: courseId ?? null,
            moduleId: moduleId ?? null,
          },
        })
        return { liked: true }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint failed')) {
        // Race condition - like was already created/deleted
        // Return opposite of what we tried to do
        return { liked: false }
      }
      throw error
    }
  }

  static async getLikeCounts(
    courseIds?: string[],
    moduleIds?: string[]
  ): Promise<Record<string, number>> {
    const counts: Record<string, number> = {}

    if (courseIds && courseIds.length > 0) {
      const courseLikes = await db.like.groupBy({
        by: ['courseId'],
        where: {
          targetType: 'COURSE',
          courseId: { in: courseIds },
        },
        _count: true,
      })
      courseLikes.forEach((item) => {
        if (item.courseId) {
          counts[item.courseId] = item._count
        }
      })
    }

    if (moduleIds && moduleIds.length > 0) {
      const moduleLikes = await db.like.groupBy({
        by: ['moduleId'],
        where: {
          targetType: 'MODULE',
          moduleId: { in: moduleIds },
        },
        _count: true,
      })
      moduleLikes.forEach((item) => {
        if (item.moduleId) {
          counts[item.moduleId] = item._count
        }
      })
    }

    return counts
  }

  static async getUserLikes(userId: string): Promise<{ courseIds: string[]; moduleIds: string[] }> {
    const likes = await db.like.findMany({
      where: { userId },
      select: {
        courseId: true,
        moduleId: true,
      },
    })

    return {
      courseIds: likes.filter((l) => l.courseId).map((l) => l.courseId as string),
      moduleIds: likes.filter((l) => l.moduleId).map((l) => l.moduleId as string),
    }
  }

  // ============ COMMENTS ============

  static async createComment(
    userId: string,
    targetType: 'COURSE' | 'MODULE',
    body: string,
    courseId?: string,
    moduleId?: string
  ): Promise<CommentWithUser> {
    // Validate inputs
    if (!courseId && !moduleId) {
      throw new Error('Either courseId or moduleId must be provided')
    }

    if (!body || body.trim().length === 0) {
      throw new Error('Comment body cannot be empty')
    }

    if (body.length > 500) {
      throw new Error('Comment body must be 500 characters or less')
    }

    try {
      const comment = await db.comment.create({
        data: {
          body,
          targetType,
          courseId: courseId || null,
          moduleId: moduleId || null,
          userId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      })

      return comment as CommentWithUser
    } catch (error) {
      throw new Error(`Failed to create comment: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async getComments(
    courseId?: string,
    moduleId?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ comments: CommentWithUser[]; total: number }> {
    // Validate inputs
    if (!courseId && !moduleId) {
      throw new Error('Either courseId or moduleId must be provided')
    }

    if (limit < 1 || limit > 100) {
      limit = 20
    }

    if (offset < 0) {
      offset = 0
    }

    try {
      const where = {
        ...(courseId && { courseId, targetType: 'COURSE' as const }),
        ...(moduleId && { moduleId, targetType: 'MODULE' as const }),
      }

      const [comments, total] = await Promise.all([
        db.comment.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        db.comment.count({ where }),
      ])

      return {
        comments: comments as CommentWithUser[],
        total,
      }
    } catch (error) {
      throw new Error(`Failed to fetch comments: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async deleteComment(commentId: string, userId: string): Promise<void> {
    try {
      // Verify ownership
      const comment = await db.comment.findUnique({
        where: { id: commentId },
        select: { userId: true },
      })

      if (!comment) {
        throw new Error('Comment not found')
      }

      if (comment.userId !== userId) {
        throw new Error('Unauthorized - you can only delete your own comments')
      }

      // Delete the comment and its replies cascade
      await db.comment.delete({
        where: { id: commentId },
      })
    } catch (error) {
      throw new Error(`Failed to delete comment: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ============ CHAT ============

  static async getOrCreateChatRoom(courseId: string): Promise<{ id: string; courseId: string | null; name: string | null; createdAt: Date }> {
    try {
      let room = await db.chatRoom.findUnique({
        where: { courseId },
        select: { id: true, courseId: true, name: true, createdAt: true },
      })

      if (!room) {
        room = await db.chatRoom.create({
          data: { courseId, type: 'COURSE' },
          select: { id: true, courseId: true, name: true, createdAt: true },
        })
      }

      return room
    } catch (error) {
      throw new Error(`Failed to get or create chat room: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async getOrCreateCommunityRoom(): Promise<{ id: string; courseId: string | null; name: string | null; createdAt: Date }> {
    try {
      let room = await db.chatRoom.findFirst({
        where: { type: 'COMMUNITY' },
        select: { id: true, courseId: true, name: true, createdAt: true },
      })

      if (!room) {
        room = await db.chatRoom.create({
          data: { type: 'COMMUNITY', name: 'Comunidad', courseId: null },
          select: { id: true, courseId: true, name: true, createdAt: true },
        })
      }

      return room
    } catch (error) {
      throw new Error(`Failed to get or create community room: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async createChatMessage(
    userId: string,
    roomId: string,
    body: string,
    imageUrl?: string
  ): Promise<ChatMessageWithUser> {
    const trimmedBody = body.trim()

    if (!trimmedBody && !imageUrl) {
      throw new Error('Message must have text or an image')
    }

    if (trimmedBody.length > 1000) {
      throw new Error('Message body must be 1000 characters or less')
    }

    try {
      const room = await db.chatRoom.findUnique({
        where: { id: roomId },
        select: { id: true },
      })

      if (!room) {
        throw new Error('Chat room not found')
      }

      const message = await db.chatMessage.create({
        data: {
          body: trimmedBody,
          imageUrl: imageUrl ?? null,
          roomId,
          userId,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      })

      return message as ChatMessageWithUser
    } catch (error) {
      throw new Error(`Failed to create chat message: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async getChatMessages(
    roomId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ messages: ChatMessageWithUser[]; total: number }> {
    // Validate inputs
    if (limit < 1 || limit > 100) {
      limit = 50
    }

    if (offset < 0) {
      offset = 0
    }

    try {
      const [messages, total] = await Promise.all([
        db.chatMessage.findMany({
          where: { roomId },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' }, // Oldest first for chat
          take: limit,
          skip: offset,
        }),
        db.chatMessage.count({ where: { roomId } }),
      ])

      return {
        messages: messages as ChatMessageWithUser[],
        total,
      }
    } catch (error) {
      throw new Error(`Failed to fetch chat messages: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

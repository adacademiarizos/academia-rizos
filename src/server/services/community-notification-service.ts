import {
  NotificationDeliveryChannel,
  NotificationPreferenceCategory,
  NotificationPriority,
} from '@prisma/client'

import { buildActiveCourseAccessWhere } from '@/lib/course-access'
import { extractCommunityMentionUserIds } from '@/lib/community-mentions'
import { db } from '@/lib/db'
import { NotificationService } from '@/server/services/notification-service'

type CommunityActor = {
  id: string
  name: string | null
  email: string
}

type CommentNotificationContext = {
  id: string
  userId: string
  targetType: 'COURSE' | 'MODULE'
  courseId: string | null
  moduleId: string | null
}

type ChatRoomNotificationContext = {
  id: string
  type: 'COURSE' | 'COMMUNITY'
  courseId: string | null
}

export type ResolvedCommentInteractionRecipients = {
  replyRecipientId?: string
  mentionRecipientIds: string[]
}

/** Input validation errors are safe to show to the author as a 400 response. */
export class CommunityInteractionValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CommunityInteractionValidationError'
  }
}

function getActorLabel(actor: CommunityActor) {
  return actor.name?.trim() || actor.email.split('@')[0] || 'Una persona'
}

function isSameCommentResource(
  parent: Pick<CommentNotificationContext, 'targetType' | 'courseId' | 'moduleId'>,
  input: { targetType: 'COURSE' | 'MODULE'; targetId: string },
) {
  if (parent.targetType !== input.targetType) return false

  return input.targetType === 'COURSE'
    ? parent.courseId === input.targetId
    : parent.moduleId === input.targetId
}

function commentActionUrl(comment: CommentNotificationContext, courseId: string) {
  if (comment.targetType === 'MODULE' && comment.moduleId) {
    return `/learn/${courseId}/modules/${comment.moduleId}#comment-${comment.id}`
  }

  // Course comments currently render on the course detail page. Keeping the
  // URL aligned with that UI makes the action link immediately navigable.
  return `/courses/${courseId}#comment-${comment.id}`
}

export class CommunityNotificationService {
  /**
   * Resolves targets before the comment is persisted. A reply target must be
   * on the exact same resource, while mentions must identify users who have
   * visibly participated in that resource and still have access to its course.
   */
  static async resolveCommentInteractionRecipients(input: {
    authorId: string
    courseId: string
    targetType: 'COURSE' | 'MODULE'
    targetId: string
    body: string
    replyToCommentId?: string
  }): Promise<ResolvedCommentInteractionRecipients> {
    const mentionIds = extractCommunityMentionUserIds(input.body)
    let replyTargetId: string | undefined

    if (input.replyToCommentId) {
      const parent = await db.comment.findUnique({
        where: { id: input.replyToCommentId },
        select: {
          userId: true,
          targetType: true,
          courseId: true,
          moduleId: true,
        },
      })

      if (!parent || !isSameCommentResource(parent, input)) {
        throw new CommunityInteractionValidationError(
          'Solo puedes responder a un comentario del mismo contenido.'
        )
      }

      replyTargetId = parent.userId
    }

    const requestedRecipientIds = [...new Set([...mentionIds, replyTargetId].filter(Boolean))]
      .filter((userId) => userId !== input.authorId) as string[]

    if (requestedRecipientIds.length === 0) {
      return { mentionRecipientIds: [] }
    }

    const now = new Date()
    const [participants, eligibleUsers] = await Promise.all([
      db.comment.findMany({
        where: {
          userId: { in: requestedRecipientIds },
          targetType: input.targetType,
          ...(input.targetType === 'COURSE'
            ? { courseId: input.targetId }
            : { moduleId: input.targetId }),
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
      db.user.findMany({
        where: {
          id: { in: requestedRecipientIds },
          OR: [
            { role: 'ADMIN' },
            {
              courseAccess: {
                some: {
                  courseId: input.courseId,
                  ...buildActiveCourseAccessWhere(now),
                },
              },
            },
          ],
        },
        select: { id: true },
      }),
    ])

    const participantIds = new Set(participants.map((participant) => participant.userId))
    const eligibleIds = new Set(eligibleUsers.map((user) => user.id))
    const authorizedRecipientIds = requestedRecipientIds.filter(
      (userId) => participantIds.has(userId) && eligibleIds.has(userId)
    )

    if (authorizedRecipientIds.length !== requestedRecipientIds.length) {
      throw new CommunityInteractionValidationError(
        'Solo puedes mencionar o responder a participantes con acceso activo a este contenido.'
      )
    }

    const replyRecipientId = replyTargetId && replyTargetId !== input.authorId
      ? replyTargetId
      : undefined

    return {
      replyRecipientId,
      // A reply is already a direct notification, so do not duplicate it when
      // the same person is also explicitly mentioned in the body.
      mentionRecipientIds: mentionIds.filter(
        (userId) => userId !== input.authorId && userId !== replyRecipientId
      ),
    }
  }

  static async dispatchCommentInteractions(input: {
    actor: CommunityActor
    comment: CommentNotificationContext
    courseId: string
    recipients: ResolvedCommentInteractionRecipients
  }) {
    const actionUrl = commentActionUrl(input.comment, input.courseId)
    const actorLabel = getActorLabel(input.actor)
    const common = {
      type: 'COMMENT',
      resource: { type: 'COMMENT', id: input.comment.id },
      relatedId: input.comment.id,
      actionUrl,
      priority: NotificationPriority.NORMAL,
      channels: [NotificationDeliveryChannel.IN_APP],
      preferenceCategory: NotificationPreferenceCategory.COMMUNITY,
    }

    const dispatches = []

    if (input.recipients.replyRecipientId) {
      dispatches.push(
        NotificationService.dispatch({
          ...common,
          eventKey: 'community.reply',
          title: 'Respondieron a tu comentario',
          message: `${actorLabel} respondió a tu comentario.`,
          recipients: [{ userId: input.recipients.replyRecipientId }],
          dedupeKey: `community:comment:${input.comment.id}:reply`,
        })
      )
    }

    if (input.recipients.mentionRecipientIds.length > 0) {
      dispatches.push(
        NotificationService.dispatch({
          ...common,
          eventKey: 'community.mention',
          title: 'Te mencionaron en un comentario',
          message: `${actorLabel} te mencionó en un comentario.`,
          recipients: input.recipients.mentionRecipientIds.map((userId) => ({ userId })),
          dedupeKey: `community:comment:${input.comment.id}:mention`,
        })
      )
    }

    const results = await Promise.all(dispatches)
    for (const result of results) {
      if (!result.ok) {
        console.error('[community] comment notification dispatch failed', result.error)
      }
    }
  }

  /**
   * Chat rooms have no membership table. A mention is therefore valid only
   * for someone who has already participated in that exact room; course-room
   * participants must also still have active access to the course.
   */
  static async resolveChatMentionRecipientIds(input: {
    authorId: string
    room: ChatRoomNotificationContext
    body: string
  }) {
    const requestedRecipientIds = extractCommunityMentionUserIds(input.body)
      .filter((userId) => userId !== input.authorId)

    if (requestedRecipientIds.length === 0) {
      return []
    }

    const participants = await db.chatMessage.findMany({
      where: {
        roomId: input.room.id,
        userId: { in: requestedRecipientIds },
      },
      select: { userId: true },
      distinct: ['userId'],
    })
    const participantIds = new Set(participants.map((participant) => participant.userId))
    let authorizedRecipientIds = requestedRecipientIds.filter((userId) => participantIds.has(userId))

    if (input.room.type === 'COURSE' && input.room.courseId && authorizedRecipientIds.length > 0) {
      const eligibleUsers = await db.user.findMany({
        where: {
          id: { in: authorizedRecipientIds },
          OR: [
            { role: 'ADMIN' },
            {
              courseAccess: {
                some: {
                  courseId: input.room.courseId,
                  ...buildActiveCourseAccessWhere(),
                },
              },
            },
          ],
        },
        select: { id: true },
      })
      const eligibleIds = new Set(eligibleUsers.map((user) => user.id))
      authorizedRecipientIds = authorizedRecipientIds.filter((userId) => eligibleIds.has(userId))
    }

    if (authorizedRecipientIds.length !== requestedRecipientIds.length) {
      throw new CommunityInteractionValidationError(
        'Solo puedes mencionar a participantes autorizados de esta sala.'
      )
    }

    return authorizedRecipientIds
  }

  static async dispatchChatMentions(input: {
    actor: CommunityActor
    message: { id: string }
    room: ChatRoomNotificationContext
    recipientIds: string[]
  }) {
    if (input.recipientIds.length === 0) return

    const actionUrl = input.room.type === 'COURSE' && input.room.courseId
      ? `/learn/${input.room.courseId}/chat#message-${input.message.id}`
      : `/community#message-${input.message.id}`

    const result = await NotificationService.dispatch({
      eventKey: 'chat.mention',
      type: 'CHAT_MESSAGE',
      title: 'Te mencionaron en el chat',
      message: `${getActorLabel(input.actor)} te mencionó en el chat.`,
      recipients: input.recipientIds.map((userId) => ({ userId })),
      channels: [NotificationDeliveryChannel.IN_APP],
      resource: { type: 'CHAT_MESSAGE', id: input.message.id },
      relatedId: input.message.id,
      actionUrl,
      priority: NotificationPriority.NORMAL,
      preferenceCategory: NotificationPreferenceCategory.COMMUNITY,
      dedupeKey: `community:chat-message:${input.message.id}:mention`,
    })

    if (!result.ok) {
      console.error('[community] chat mention dispatch failed', result.error)
    }
  }
}

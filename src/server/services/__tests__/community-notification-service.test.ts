import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { NotificationDeliveryChannel, NotificationPreferenceCategory } from '@prisma/client'

vi.mock('@/lib/db', () => ({
  db: {
    comment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    chatMessage: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/server/services/notification-service', () => ({
  NotificationService: {
    dispatch: vi.fn(),
  },
}))

import { db } from '@/lib/db'
import {
  CommunityInteractionValidationError,
  CommunityNotificationService,
} from '@/server/services/community-notification-service'
import { NotificationService } from '@/server/services/notification-service'

const mockedDb = db as unknown as {
  comment: { findUnique: Mock; findMany: Mock }
  chatMessage: { findMany: Mock }
  user: { findMany: Mock }
}

const mockedNotifications = NotificationService as unknown as {
  dispatch: Mock
}

describe('CommunityNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedNotifications.dispatch.mockResolvedValue({ ok: true, notifications: 1, deliveries: 1 })
  })

  it('rejects a reply that targets a comment from a different module', async () => {
    mockedDb.comment.findUnique.mockResolvedValue({
      userId: 'user-2',
      targetType: 'MODULE',
      courseId: null,
      moduleId: 'module-other',
    })

    await expect(
      CommunityNotificationService.resolveCommentInteractionRecipients({
        authorId: 'user-1',
        courseId: 'course-1',
        targetType: 'MODULE',
        targetId: 'module-1',
        body: 'Respuesta',
        replyToCommentId: 'comment-other',
      })
    ).rejects.toBeInstanceOf(CommunityInteractionValidationError)

    expect(mockedDb.user.findMany).not.toHaveBeenCalled()
  })

  it('allows only an active participant of the same comment resource', async () => {
    mockedDb.comment.findUnique.mockResolvedValue({
      userId: 'user-2',
      targetType: 'COURSE',
      courseId: 'course-1',
      moduleId: null,
    })
    mockedDb.comment.findMany.mockResolvedValue([{ userId: 'user-2' }, { userId: 'user-3' }])
    mockedDb.user.findMany.mockResolvedValue([{ id: 'user-2' }, { id: 'user-3' }])

    await expect(
      CommunityNotificationService.resolveCommentInteractionRecipients({
        authorId: 'user-1',
        courseId: 'course-1',
        targetType: 'COURSE',
        targetId: 'course-1',
        body: 'Gracias @[Ana](user-3)',
        replyToCommentId: 'comment-2',
      })
    ).resolves.toEqual({
      replyRecipientId: 'user-2',
      mentionRecipientIds: ['user-3'],
    })

    expect(mockedDb.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          targetType: 'COURSE',
          courseId: 'course-1',
        }),
      })
    )
  })

  it('rejects a mention for a user who did not participate in the same room', async () => {
    mockedDb.chatMessage.findMany.mockResolvedValue([])

    await expect(
      CommunityNotificationService.resolveChatMentionRecipientIds({
        authorId: 'user-1',
        room: { id: 'room-1', type: 'COMMUNITY', courseId: null },
        body: 'Hola @[Alguien](user-outside)',
      })
    ).rejects.toBeInstanceOf(CommunityInteractionValidationError)
  })

  it('dispatches reply and mention as direct in-app notifications with a safe action URL', async () => {
    await CommunityNotificationService.dispatchCommentInteractions({
      actor: { id: 'user-1', name: 'Ana', email: 'ana@example.com' },
      comment: {
        id: 'comment-1',
        userId: 'user-1',
        targetType: 'MODULE',
        courseId: null,
        moduleId: 'module-1',
      },
      courseId: 'course-1',
      recipients: { replyRecipientId: 'user-2', mentionRecipientIds: ['user-3'] },
    })

    expect(mockedNotifications.dispatch).toHaveBeenCalledTimes(2)
    expect(mockedNotifications.dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        eventKey: 'community.reply',
        recipients: [{ userId: 'user-2' }],
        channels: [NotificationDeliveryChannel.IN_APP],
        preferenceCategory: NotificationPreferenceCategory.COMMUNITY,
        actionUrl: '/learn/course-1/modules/module-1#comment-comment-1',
      })
    )
    expect(mockedNotifications.dispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        eventKey: 'community.mention',
        recipients: [{ userId: 'user-3' }],
        channels: [NotificationDeliveryChannel.IN_APP],
      })
    )
  })
})

import { afterAll, describe, expect, it } from 'vitest'
import { lessonAuthoringSelect, moduleAuthoringSelect } from '@/lib/academy-content-selects'
import { db } from '@/lib/db'

describe('course content schema parity', () => {
  afterAll(async () => {
    await db.$disconnect()
  })

  it('supports module and lesson compatibility fields across create, read, and update', async () => {
    const course = await db.course.create({
      data: {
        title: `Schema parity ${crypto.randomUUID()}`,
        priceCents: 0,
        contentStructure: 'MODULES',
      },
      select: { id: true },
    })

    try {
      const moduleRecord = await db.module.create({
        data: {
          courseId: course.id,
          order: 0,
          title: 'Compatibility module',
          videoUrl: 'https://example.com/module-legacy.mp4',
          videoFileUrl: 'https://cdn.example.com/module.mp4',
          transcript: 'Initial module transcript',
        },
        select: moduleAuthoringSelect,
      })

      expect(moduleRecord).toMatchObject({
        videoUrl: 'https://example.com/module-legacy.mp4',
        videoFileUrl: 'https://cdn.example.com/module.mp4',
        transcript: 'Initial module transcript',
      })

      const lesson = await db.lesson.create({
        data: {
          courseId: course.id,
          moduleId: moduleRecord.id,
          order: 0,
          title: 'Compatibility lesson',
          videoUrl: 'https://example.com/lesson-legacy.mp4',
          videoFileUrl: 'https://cdn.example.com/lesson.mp4',
          transcript: 'Initial lesson transcript',
        },
        select: lessonAuthoringSelect,
      })

      await expect(
        db.module.findUniqueOrThrow({
          where: { id: moduleRecord.id },
          select: moduleAuthoringSelect,
        })
      ).resolves.toMatchObject(moduleRecord)
      await expect(
        db.lesson.findUniqueOrThrow({
          where: { id: lesson.id },
          select: lessonAuthoringSelect,
        })
      ).resolves.toMatchObject(lesson)

      await expect(
        db.module.update({
          where: { id: moduleRecord.id },
          data: { transcript: 'Updated module transcript' },
          select: moduleAuthoringSelect,
        })
      ).resolves.toMatchObject({ transcript: 'Updated module transcript' })
      await expect(
        db.lesson.update({
          where: { id: lesson.id },
          data: { transcript: 'Updated lesson transcript' },
          select: lessonAuthoringSelect,
        })
      ).resolves.toMatchObject({ transcript: 'Updated lesson transcript' })
    } finally {
      await db.course.delete({ where: { id: course.id } })
    }
  })
})

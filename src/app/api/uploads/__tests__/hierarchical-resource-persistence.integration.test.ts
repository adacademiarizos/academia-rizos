import { afterAll, describe, expect, it, vi } from 'vitest'
import { LearningScope } from '@prisma/client'

vi.mock('@/lib/admin-auth', () => ({
  checkAdminAuth: vi.fn().mockResolvedValue({ authorized: true }),
}))

import { POST as confirmUpload } from '@/app/api/uploads/confirm/route'
import { db } from '@/lib/db'
import { createLearningResource } from '@/server/services/learning-content-service'

function confirmRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/uploads/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('hierarchical resource persistence', () => {
  afterAll(async () => {
    await db.$disconnect()
  })

  it('creates one LearningResource per hierarchy target and no legacy duplicate rows', async () => {
    const course = await db.course.create({
      data: {
        title: `Resource contract ${crypto.randomUUID()}`,
        priceCents: 0,
        contentStructure: 'BOTH',
      },
      select: { id: true },
    })

    try {
      const moduleRecord = await db.module.create({
        data: { courseId: course.id, order: 0, title: 'Resource module' },
        select: { id: true },
      })
      const style = await db.moduleStyle.create({
        data: { courseId: course.id, order: 0, name: 'Resource style', slug: `resource-${crypto.randomUUID()}` },
        select: { id: true },
      })
      const lesson = await db.lesson.create({
        data: { courseId: course.id, moduleId: moduleRecord.id, order: 0, title: 'Resource lesson' },
        select: { id: true },
      })

      const targets = [
        { scope: LearningScope.COURSE, scopeId: course.id },
        { scope: LearningScope.MODULE, scopeId: moduleRecord.id },
        { scope: LearningScope.STYLE, scopeId: style.id },
        { scope: LearningScope.LESSON, scopeId: lesson.id },
      ]

      for (const [index, target] of targets.entries()) {
        const fileUrl = `https://cdn.example.test/resource-${index}.pdf`
        const metadata = {
          fileUrl,
          fileName: `resource-${index}.pdf`,
          fileSize: 1024 + index,
          mimeType: 'application/pdf',
          uploadType: 'resource',
          courseId: course.id,
          deferPersistence: true,
          learningScope: target.scope,
          learningScopeId: target.scopeId,
        }

        expect((await confirmUpload(confirmRequest(metadata) as never)).status).toBe(200)
        expect((await confirmUpload(confirmRequest(metadata) as never)).status).toBe(200)

        await createLearningResource(target, {
          title: `Resource ${index}`,
          fileUrl,
          fileType: 'pdf',
          fileSize: metadata.fileSize,
        })
      }

      expect(await db.courseResource.count({ where: { courseId: course.id } })).toBe(0)
      expect(await db.moduleResource.count({ where: { moduleId: moduleRecord.id } })).toBe(0)

      const resources = await db.learningResource.findMany({
        where: {
          OR: [
            { courseId: course.id },
            { moduleId: moduleRecord.id },
            { styleId: style.id },
            { lessonId: lesson.id },
          ],
        },
        select: { scope: true, courseId: true, moduleId: true, styleId: true, lessonId: true },
        orderBy: { createdAt: 'asc' },
      })

      expect(resources).toEqual([
        { scope: 'COURSE', courseId: course.id, moduleId: null, styleId: null, lessonId: null },
        { scope: 'MODULE', courseId: null, moduleId: moduleRecord.id, styleId: null, lessonId: null },
        { scope: 'STYLE', courseId: null, moduleId: null, styleId: style.id, lessonId: null },
        { scope: 'LESSON', courseId: null, moduleId: null, styleId: null, lessonId: lesson.id },
      ])
    } finally {
      await db.course.delete({ where: { id: course.id } })
    }
  })
})

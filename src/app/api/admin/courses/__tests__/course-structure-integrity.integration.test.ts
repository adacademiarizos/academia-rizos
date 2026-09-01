import { afterAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/admin-auth', () => ({
  checkAdminAuth: vi.fn().mockResolvedValue({ authorized: true }),
}))

import { POST as createModule } from '@/app/api/admin/courses/[courseId]/modules/route'
import { db } from '@/lib/db'

function createModuleRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/courses/course-id/modules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('course structure integrity', () => {
  afterAll(async () => {
    await db.$disconnect()
  })

  it('rejects a lesson that belongs to both a module and a style', async () => {
    const course = await db.course.create({
      data: { title: `Integrity ${crypto.randomUUID()}`, priceCents: 0, contentStructure: 'BOTH' },
      select: { id: true },
    })
    try {
      const moduleRecord = await db.module.create({ data: { courseId: course.id, order: 0, title: 'Module' }, select: { id: true } })
      const style = await db.moduleStyle.create({
        data: { courseId: course.id, order: 0, name: 'Style', slug: `style-${crypto.randomUUID()}` },
        select: { id: true },
      })

      await expect(
        db.lesson.create({ data: { courseId: course.id, moduleId: moduleRecord.id, styleId: style.id, order: 0, title: 'Both parents' } })
      ).rejects.toThrow()
    } finally {
      await db.course.delete({ where: { id: course.id } })
    }
  })

  it('rejects a lesson with neither a module nor a style', async () => {
    const course = await db.course.create({
      data: { title: `Integrity ${crypto.randomUUID()}`, priceCents: 0, contentStructure: 'BOTH' },
      select: { id: true },
    })
    try {
      await expect(
        db.lesson.create({ data: { courseId: course.id, moduleId: null, styleId: null, order: 0, title: 'Orphan lesson' } })
      ).rejects.toThrow()
    } finally {
      await db.course.delete({ where: { id: course.id } })
    }
  })

  it('accepts a lesson with exactly one parent', async () => {
    const course = await db.course.create({
      data: { title: `Integrity ${crypto.randomUUID()}`, priceCents: 0, contentStructure: 'MODULES' },
      select: { id: true },
    })
    try {
      const moduleRecord = await db.module.create({ data: { courseId: course.id, order: 0, title: 'Module' }, select: { id: true } })
      const lesson = await db.lesson.create({
        data: { courseId: course.id, moduleId: moduleRecord.id, styleId: null, order: 0, title: 'Valid lesson' },
        select: { id: true },
      })
      expect(lesson.id).toBeTruthy()
    } finally {
      await db.course.delete({ where: { id: course.id } })
    }
  })

  it('prevents two lessons in the same module from sharing an order (DB-level, no app-level lock needed)', async () => {
    const course = await db.course.create({
      data: { title: `Integrity ${crypto.randomUUID()}`, priceCents: 0, contentStructure: 'MODULES' },
      select: { id: true },
    })
    try {
      const moduleRecord = await db.module.create({ data: { courseId: course.id, order: 0, title: 'Module' }, select: { id: true } })
      await db.lesson.create({ data: { courseId: course.id, moduleId: moduleRecord.id, order: 0, title: 'First' } })

      await expect(
        db.lesson.create({ data: { courseId: course.id, moduleId: moduleRecord.id, order: 0, title: 'Duplicate order' } })
      ).rejects.toThrow()
    } finally {
      await db.course.delete({ where: { id: course.id } })
    }
  })

  it('returns a clean 409 (not a raw Prisma error) when two modules race for the same order', async () => {
    const course = await db.course.create({
      data: { title: `Integrity ${crypto.randomUUID()}`, priceCents: 0, contentStructure: 'MODULES' },
      select: { id: true },
    })
    try {
      const [first, second] = await Promise.allSettled([
        createModule(createModuleRequest({ order: 0, title: 'Module A' }) as never, { params: Promise.resolve({ courseId: course.id }) }),
        createModule(createModuleRequest({ order: 0, title: 'Module B' }) as never, { params: Promise.resolve({ courseId: course.id }) }),
      ])

      const statuses = [first, second].map((result) => (result.status === 'fulfilled' ? result.value.status : null))
      expect(statuses).toContain(201)
      expect(statuses).toContain(409)

      for (const result of [first, second]) {
        if (result.status === 'fulfilled' && result.value.status === 409) {
          const body = await result.value.json()
          expect(body.error).not.toMatch(/prisma|constraint|unique/i)
        }
      }
    } finally {
      await db.course.deleteMany({ where: { id: course.id } })
    }
  })
})

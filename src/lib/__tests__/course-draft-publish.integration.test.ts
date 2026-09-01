import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import {
  CourseDraftValidationError,
  discardCourseDraft,
  loadCourseEditorDraft,
  publishCourseDraft,
  saveCourseDraft,
} from '@/lib/course-draft'

const createdCourseIds: string[] = []

async function createCourseFixture() {
  const suffix = randomUUID()
  const course = await db.course.create({
    data: {
      title: `Published ${suffix}`,
      description: 'Published description',
      priceCents: 2500,
      contentStructure: 'BOTH',
      // Publishing an active course requires it; without it no certificate
      // could be issued when a student passes the final exam.
      certificateSlogan: 'Especialización en cuidado de rizos',
    },
  })
  createdCourseIds.push(course.id)

  const module = await db.module.create({
    data: {
      courseId: course.id,
      order: 0,
      title: 'Published module',
      videoFileUrl: 'https://cdn.example.com/module-old.mp4',
      bannerImageUrl: 'https://cdn.example.com/module-old.webp',
    },
  })
  const style = await db.moduleStyle.create({
    data: {
      courseId: course.id,
      order: 0,
      name: `Published style ${suffix}`,
      slug: `published-style-${suffix}`,
      videoFileUrl: 'https://cdn.example.com/style-old.mp4',
      bannerImageUrl: 'https://cdn.example.com/style-old.webp',
    },
  })
  const moduleLesson = await db.lesson.create({
    data: {
      courseId: course.id,
      moduleId: module.id,
      order: 0,
      title: 'Published module lesson',
      videoFileUrl: 'https://cdn.example.com/module-lesson-old.mp4',
    },
  })
  const styleLesson = await db.lesson.create({
    data: {
      courseId: course.id,
      styleId: style.id,
      order: 0,
      title: 'Published style lesson',
      videoFileUrl: 'https://cdn.example.com/style-lesson-old.mp4',
    },
  })

  return { course, module, style, moduleLesson, styleLesson }
}

afterEach(async () => {
  if (createdCourseIds.length === 0) return
  await db.course.deleteMany({ where: { id: { in: createdCourseIds.splice(0) } } })
})

describe('course draft publication', () => {
  it('keeps a saved draft isolated from published course data and can discard it', async () => {
    const fixture = await createCourseFixture()
    const editor = await loadCourseEditorDraft(fixture.course.id)
    expect(editor?.source).toBe('PUBLISHED')

    const draft = structuredClone(editor!.payload)
    draft.course.title = 'Unpublished title'
    draft.styles[0].videoFileUrl = 'https://cdn.example.com/style-draft.mp4'
    await saveCourseDraft(fixture.course.id, draft)

    const publishedCourse = await db.course.findUniqueOrThrow({ where: { id: fixture.course.id } })
    const publishedStyle = await db.moduleStyle.findUniqueOrThrow({ where: { id: fixture.style.id } })
    expect(publishedCourse.title).toBe(fixture.course.title)
    expect(publishedStyle.videoFileUrl).toBe('https://cdn.example.com/style-old.mp4')

    const savedEditor = await loadCourseEditorDraft(fixture.course.id)
    expect(savedEditor).toMatchObject({ source: 'DRAFT', payload: { course: { title: 'Unpublished title' } } })

    await discardCourseDraft(fixture.course.id)
    expect((await loadCourseEditorDraft(fixture.course.id))?.source).toBe('PUBLISHED')
  })

  it('publishes module, style, and lesson media and removes the draft atomically', async () => {
    const fixture = await createCourseFixture()
    const draft = structuredClone((await loadCourseEditorDraft(fixture.course.id))!.payload)
    draft.course.title = 'Published update'
    draft.modules[0].videoFileUrl = 'https://cdn.example.com/module-new.mp4'
    draft.modules[0].bannerImageUrl = 'https://cdn.example.com/module-new.webp'
    draft.modules[0].lessons[0].videoFileUrl = 'https://cdn.example.com/module-lesson-new.mp4'
    draft.styles[0].videoFileUrl = 'https://cdn.example.com/style-new.mp4'
    draft.styles[0].bannerImageUrl = 'https://cdn.example.com/style-new.webp'
    draft.styles[0].lessons[0].videoFileUrl = 'https://cdn.example.com/style-lesson-new.mp4'
    await saveCourseDraft(fixture.course.id, draft)

    await publishCourseDraft(fixture.course.id, draft)

    expect(await db.course.findUniqueOrThrow({ where: { id: fixture.course.id } })).toMatchObject({ title: 'Published update' })
    expect(await db.module.findUniqueOrThrow({ where: { id: fixture.module.id } })).toMatchObject({
      videoFileUrl: 'https://cdn.example.com/module-new.mp4',
      bannerImageUrl: 'https://cdn.example.com/module-new.webp',
    })
    expect(await db.moduleStyle.findUniqueOrThrow({ where: { id: fixture.style.id } })).toMatchObject({
      videoFileUrl: 'https://cdn.example.com/style-new.mp4',
      bannerImageUrl: 'https://cdn.example.com/style-new.webp',
    })
    expect(await db.lesson.findUniqueOrThrow({ where: { id: fixture.moduleLesson.id } })).toMatchObject({
      videoFileUrl: 'https://cdn.example.com/module-lesson-new.mp4',
    })
    expect(await db.lesson.findUniqueOrThrow({ where: { id: fixture.styleLesson.id } })).toMatchObject({
      videoFileUrl: 'https://cdn.example.com/style-lesson-new.mp4',
    })
    expect((await loadCourseEditorDraft(fixture.course.id))?.source).toBe('PUBLISHED')
  })

  it('rolls back published changes and retains the draft when a nested entity belongs to another course', async () => {
    const fixture = await createCourseFixture()
    const foreign = await createCourseFixture()
    const draft = structuredClone((await loadCourseEditorDraft(fixture.course.id))!.payload)
    draft.course.title = 'Must roll back'
    draft.styles[0].videoFileUrl = 'https://cdn.example.com/style-must-roll-back.mp4'
    draft.styles[0].lessons[0].id = foreign.styleLesson.id
    await saveCourseDraft(fixture.course.id, draft)

    await expect(publishCourseDraft(fixture.course.id, draft)).rejects.toBeInstanceOf(CourseDraftValidationError)

    expect(await db.course.findUniqueOrThrow({ where: { id: fixture.course.id } })).toMatchObject({ title: fixture.course.title })
    expect(await db.moduleStyle.findUniqueOrThrow({ where: { id: fixture.style.id } })).toMatchObject({
      videoFileUrl: 'https://cdn.example.com/style-old.mp4',
    })
    expect((await loadCourseEditorDraft(fixture.course.id))?.source).toBe('DRAFT')
  })

  it('publishes a course large enough to exceed the default interactive transaction timeout', async () => {
    const fixture = await createCourseFixture()
    const draft = structuredClone((await loadCourseEditorDraft(fixture.course.id))!.payload)

    const MODULE_COUNT = 12
    const LESSONS_PER_MODULE = 12
    draft.modules = Array.from({ length: MODULE_COUNT }, (_, moduleIndex) => ({
      clientId: `draft:module-${moduleIndex}`,
      order: moduleIndex,
      title: `Bulk module ${moduleIndex}`,
      description: null,
      videoFileUrl: `https://cdn.example.com/bulk-module-${moduleIndex}.mp4`,
      bannerImageUrl: null,
      lessons: Array.from({ length: LESSONS_PER_MODULE }, (_, lessonIndex) => ({
        clientId: `draft:module-${moduleIndex}-lesson-${lessonIndex}`,
        order: lessonIndex,
        title: `Bulk lesson ${moduleIndex}-${lessonIndex}`,
        description: null,
        videoFileUrl: `https://cdn.example.com/bulk-${moduleIndex}-${lessonIndex}.mp4`,
      })),
    }))
    draft.styles = []
    draft.course.contentStructure = 'BOTH'

    await publishCourseDraft(fixture.course.id, draft)

    const modules = await db.module.findMany({ where: { courseId: fixture.course.id, styleId: null } })
    const lessons = await db.lesson.findMany({ where: { courseId: fixture.course.id, styleId: null } })
    expect(modules).toHaveLength(MODULE_COUNT)
    expect(lessons).toHaveLength(MODULE_COUNT * LESSONS_PER_MODULE)
    expect((await loadCourseEditorDraft(fixture.course.id))?.source).toBe('PUBLISHED')
  })

  it('refuses to publish an active course with no certificate slogan', async () => {
    const fixture = await createCourseFixture()
    await db.course.update({ where: { id: fixture.course.id }, data: { certificateSlogan: null } })
    const draft = structuredClone((await loadCourseEditorDraft(fixture.course.id))!.payload)
    draft.course.isActive = true
    draft.course.certificateSlogan = null
    draft.course.title = 'Must not publish'

    // A draft is work in progress, so saving one is still allowed.
    await expect(saveCourseDraft(fixture.course.id, draft)).resolves.toBeTruthy()
    await expect(publishCourseDraft(fixture.course.id, draft)).rejects.toBeInstanceOf(CourseDraftValidationError)
    expect(await db.course.findUniqueOrThrow({ where: { id: fixture.course.id } })).toMatchObject({ title: fixture.course.title })

    // The same course publishes once the slogan is filled in.
    draft.course.certificateSlogan = 'Especialización en definición de rizos'
    await publishCourseDraft(fixture.course.id, draft)
    expect(await db.course.findUniqueOrThrow({ where: { id: fixture.course.id } })).toMatchObject({
      title: 'Must not publish',
      certificateSlogan: 'Especialización en definición de rizos',
    })
  })
})

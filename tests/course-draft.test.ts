jest.mock('@/lib/db', () => ({
  db: {
    course: { findUnique: jest.fn() },
    courseDraft: { findUnique: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import {
  buildPublishedCourseDraft,
  CourseDraftValidationError,
  draftRouteId,
  loadCourseEditorDraft,
  saveCourseDraft,
} from '@/lib/course-draft'
import { db } from '@/lib/db'

const publishedCourse = {
  id: 'course-1',
  title: 'Rizos definidos',
  description: 'Curso publicado',
  trailerUrl: null,
  thumbnailUrl: 'https://example.com/thumbnail.webp',
  priceCents: 30000,
  rentalDays: null,
  isActive: true,
  contentStructure: 'BOTH',
  modules: [{
    id: 'module-1',
    styleId: null,
    order: 0,
    title: 'Preparación',
    description: null,
    videoFileUrl: 'https://cdn.example.com/module.mp4',
    lessons: [{
      id: 'lesson-module-1',
      moduleId: 'module-1',
      styleId: null,
      order: 0,
      title: 'Introducción',
      description: null,
      videoFileUrl: 'https://cdn.example.com/lesson.mp4',
    }],
  }],
  styles: [{
    id: 'style-1',
    order: 0,
    name: 'General',
    description: null,
    isActive: true,
    lessons: [{
      id: 'lesson-style-1',
      moduleId: null,
      styleId: 'style-1',
      order: 0,
      title: 'Definición',
      description: null,
      videoFileUrl: 'https://cdn.example.com/style-lesson.mp4',
    }],
  }],
}

describe('course draft helpers', () => {
  it('creates separate module and style snapshots without losing IDs or the thumbnail', () => {
    const draft = buildPublishedCourseDraft(publishedCourse as never)

    expect(draft.course).toMatchObject({
      thumbnailUrl: 'https://example.com/thumbnail.webp',
      contentStructure: 'BOTH',
    })
    expect(draft.modules[0]).toMatchObject({ id: 'module-1', clientId: 'published:module-1' })
    expect(draft.modules[0].lessons[0]).toMatchObject({ id: 'lesson-module-1' })
    expect(draft.styles[0]).toMatchObject({ id: 'style-1', clientId: 'published:style-1' })
    expect(draft.styles[0].lessons[0]).toMatchObject({ id: 'lesson-style-1' })
  })

  it('uses persisted IDs for published routes and client IDs for unpublished content', () => {
    expect(draftRouteId({ id: 'module-1', clientId: 'published:module-1' })).toBe('module-1')
    expect(draftRouteId({ clientId: 'draft:module:new' })).toBe('draft:module:new')
  })

  it('marks courses without a selected structure for the one-time migration assistant', async () => {
    ;(db.course.findUnique as jest.Mock).mockResolvedValueOnce({ ...publishedCourse, contentStructure: null })
    ;(db.courseDraft.findUnique as jest.Mock).mockResolvedValueOnce(null)

    const editor = await loadCourseEditorDraft('course-1')

    expect(editor?.needsStructureMigration).toBe(true)
    expect(editor?.payload.course.contentStructure).toBe('MODULES')
  })

  it('rejects a module draft that duplicates an order before it can be saved', async () => {
    const draft = buildPublishedCourseDraft(publishedCourse as never)
    draft.modules.push({ ...draft.modules[0], clientId: 'draft:module:duplicate', id: undefined })

    await expect(saveCourseDraft('course-1', draft)).rejects.toBeInstanceOf(CourseDraftValidationError)
  })

  it('rejects styles in a modules-only course', async () => {
    const draft = buildPublishedCourseDraft({ ...publishedCourse, contentStructure: 'MODULES', styles: [] } as never)
    draft.styles.push({ ...buildPublishedCourseDraft(publishedCourse as never).styles[0], id: undefined, clientId: 'draft:style:1' })

    await expect(saveCourseDraft('course-1', draft)).rejects.toBeInstanceOf(CourseDraftValidationError)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  checkAdminAuth,
  generateUploadPresignedUrl,
  resolveScopeTarget,
  courseResourceCreate,
  moduleResourceCreate,
  moduleUpdate,
  lessonUpdate,
} = vi.hoisted(() => ({
  checkAdminAuth: vi.fn(),
  generateUploadPresignedUrl: vi.fn(),
  resolveScopeTarget: vi.fn(),
  courseResourceCreate: vi.fn(),
  moduleResourceCreate: vi.fn(),
  moduleUpdate: vi.fn(),
  lessonUpdate: vi.fn(),
}))

vi.mock('@/lib/admin-auth', () => ({ checkAdminAuth }))
vi.mock('@/lib/course-access-control', () => ({
  authorizeCourseAccessByCourseId: vi.fn(),
  toAccessDeniedResponse: vi.fn(),
}))
vi.mock('@/lib/storage', () => ({
  generateUploadPresignedUrl,
  StorageConfigurationError: class StorageConfigurationError extends Error {},
}))
vi.mock('@/lib/db', () => ({
  db: {
    courseResource: { create: courseResourceCreate },
    moduleResource: { create: moduleResourceCreate },
    module: { update: moduleUpdate },
    lesson: { update: lessonUpdate },
  },
}))
vi.mock('@/server/services/learning-content-service', () => ({
  resolveScopeTarget,
  LearningContentError: class LearningContentError extends Error {
    constructor(
      message: string,
      public readonly status = 400,
      public readonly code = 'LEARNING_CONTENT_ERROR'
    ) {
      super(message)
    }
  },
}))

import { resourceSchema } from '@/lib/learning-api'
import { buildUploadRequestMetadata } from '@/lib/upload-contract'
import { LearningContentError } from '@/server/services/learning-content-service'
import { POST as confirmUpload } from '@/app/api/uploads/confirm/route'
import { POST as createPresignedUpload } from '@/app/api/uploads/presigned/route'

const MB = 1024 * 1024

function jsonRequest(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function resourceMetadata(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contentType: 'application/pdf',
    fileSize: 1024,
    uploadType: 'resource',
    fileName: 'guide.pdf',
    courseId: 'course-1',
    deferPersistence: true,
    learningScope: 'COURSE',
    learningScopeId: 'course-1',
    ...overrides,
  }
}

describe('hierarchical resource upload contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkAdminAuth.mockResolvedValue({ authorized: true })
    generateUploadPresignedUrl.mockResolvedValue('https://uploads.example.test/signed')
    resolveScopeTarget.mockResolvedValue({ scope: 'COURSE', scopeId: 'course-1', courseId: 'course-1' })
  })

  it.each([
    ['missing', undefined],
    ['zero', 0],
    ['negative', -1],
    ['non-integer', 1.5],
    ['oversized', 100 * MB + 1],
  ])('rejects %s resource sizes before presigning', async (_label, fileSize) => {
    const metadata = resourceMetadata()
    if (fileSize === undefined) delete metadata.fileSize
    else metadata.fileSize = fileSize

    const response = await createPresignedUpload(
      jsonRequest('http://localhost/api/uploads/presigned', metadata) as never
    )

    expect(response.status).toBe(400)
    expect(generateUploadPresignedUrl).not.toHaveBeenCalled()
  })

  it.each([
    ['missing', undefined],
    ['zero', 0],
    ['negative', -1],
    ['non-integer', 1.5],
    ['oversized', 100 * MB + 1],
  ])('rejects %s resource sizes during confirmation', async (_label, fileSize) => {
    const metadata = resourceMetadata({
      fileUrl: 'https://cdn.example.test/guide.pdf',
      mimeType: 'application/pdf',
    })
    if (fileSize === undefined) delete metadata.fileSize
    else metadata.fileSize = fileSize

    const response = await confirmUpload(
      jsonRequest('http://localhost/api/uploads/confirm', metadata) as never
    )

    expect(response.status).toBe(400)
    expect(courseResourceCreate).not.toHaveBeenCalled()
    expect(moduleResourceCreate).not.toHaveBeenCalled()
  })

  it('rejects a deferred resource target that belongs to another course before presigning', async () => {
    resolveScopeTarget.mockResolvedValue({ scope: 'MODULE', scopeId: 'module-1', courseId: 'course-1' })

    const response = await createPresignedUpload(
      jsonRequest('http://localhost/api/uploads/presigned', resourceMetadata({
        learningScope: 'MODULE',
        learningScopeId: 'module-1',
        courseId: 'course-2',
      })) as never
    )

    expect(response.status).toBe(400)
    expect(generateUploadPresignedUrl).not.toHaveBeenCalled()
  })

  it('returns a safe not-found response when the hierarchy target does not exist', async () => {
    resolveScopeTarget.mockRejectedValue(
      new LearningContentError('El módulo no existe.', 404, 'SCOPE_NOT_FOUND')
    )

    const response = await createPresignedUpload(
      jsonRequest('http://localhost/api/uploads/presigned', resourceMetadata({
        learningScope: 'MODULE',
        learningScopeId: 'missing-module',
      })) as never
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'El módulo no existe.',
      code: 'SCOPE_NOT_FOUND',
    })
    expect(generateUploadPresignedUrl).not.toHaveBeenCalled()
  })

  it('rejects a deferred resource target that belongs to another course during confirmation', async () => {
    resolveScopeTarget.mockResolvedValue({ scope: 'LESSON', scopeId: 'lesson-1', courseId: 'course-1' })

    const response = await confirmUpload(
      jsonRequest('http://localhost/api/uploads/confirm', {
        ...resourceMetadata({ learningScope: 'LESSON', learningScopeId: 'lesson-1', courseId: 'course-2' }),
        fileUrl: 'https://cdn.example.test/guide.pdf',
        mimeType: 'application/pdf',
      }) as never
    )

    expect(response.status).toBe(400)
    expect(courseResourceCreate).not.toHaveBeenCalled()
    expect(moduleResourceCreate).not.toHaveBeenCalled()
  })

  it('confirms deferred persistence without creating a legacy resource row', async () => {
    const response = await confirmUpload(
      jsonRequest('http://localhost/api/uploads/confirm', {
        ...resourceMetadata(),
        fileUrl: 'https://cdn.example.test/guide.pdf',
        mimeType: 'application/pdf',
      }) as never
    )

    expect(response.status).toBe(200)
    expect(courseResourceCreate).not.toHaveBeenCalled()
    expect(moduleResourceCreate).not.toHaveBeenCalled()
  })

  it('propagates deferred hierarchy metadata in the client upload contract', () => {
    expect(buildUploadRequestMetadata(
      { name: 'guide.pdf', size: 1024, type: 'application/pdf' },
      {
        uploadType: 'resource',
        courseId: 'course-1',
        deferPersistence: true,
        learningScope: 'STYLE',
        learningScopeId: 'style-1',
      }
    )).toMatchObject({
      deferPersistence: true,
      learningScope: 'STYLE',
      learningScopeId: 'style-1',
      courseId: 'course-1',
    })
  })

  it.each([0, -1, 1.5, 100 * MB + 1])('rejects invalid LearningResource fileSize %s', (fileSize) => {
    expect(resourceSchema.safeParse({
      title: 'Guide',
      fileUrl: 'https://cdn.example.test/guide.pdf',
      fileType: 'pdf',
      fileSize,
    }).success).toBe(false)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_VIDEO_BYTES } from '@/lib/video-upload'

vi.mock('@/lib/admin-auth', () => ({
  checkAdminAuth: vi.fn().mockResolvedValue({ authorized: true }),
}))

const { createMultipartUpload, generateMultipartPartPresignedUrl, completeMultipartUpload, abortMultipartUpload, getPublicFileUrl } = vi.hoisted(() => ({
  createMultipartUpload: vi.fn(),
  generateMultipartPartPresignedUrl: vi.fn(),
  completeMultipartUpload: vi.fn(),
  abortMultipartUpload: vi.fn(),
  getPublicFileUrl: vi.fn((key: string) => `https://cdn.example.test/${key}`),
}))

vi.mock('@/lib/storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage')>('@/lib/storage')
  return {
    ...actual,
    createMultipartUpload,
    generateMultipartPartPresignedUrl,
    completeMultipartUpload,
    abortMultipartUpload,
    getPublicFileUrl,
  }
})

import { POST } from '@/app/api/uploads/multipart/route'

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/uploads/multipart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never
}

describe('POST /api/uploads/multipart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createMultipartUpload.mockResolvedValue('upload-id-123')
  })

  it('creates a multipart upload keyed under the course, not the lesson/module/style', async () => {
    const res = await POST(request({
      action: 'create',
      courseId: 'course-1',
      fileName: 'lesson-video.mp4',
      fileSize: 5 * 1024 * 1024,
      contentType: 'video/mp4',
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(createMultipartUpload).toHaveBeenCalledTimes(1)
    const [key] = createMultipartUpload.mock.calls[0]
    expect(key).toMatch(/^courses\/course-1\/video\//)
  })

  it('rejects a video over the size limit before touching storage', async () => {
    const res = await POST(request({
      action: 'create',
      courseId: 'course-1',
      fileName: 'huge.mp4',
      fileSize: MAX_VIDEO_BYTES + 1,
      contentType: 'video/mp4',
    }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(createMultipartUpload).not.toHaveBeenCalled()
  })

  it('rejects an unsupported content type', async () => {
    const res = await POST(request({
      action: 'create',
      courseId: 'course-1',
      fileName: 'video.avi',
      fileSize: 1024,
      contentType: 'video/x-msvideo',
    }))
    expect(res.status).toBe(400)
    expect(createMultipartUpload).not.toHaveBeenCalled()
  })

  it('rejects a key that does not start with the courses/ prefix', async () => {
    const res = await POST(request({
      action: 'sign-parts',
      key: '../../etc/passwd',
      uploadId: 'a-valid-upload-id',
      partNumbers: [1],
    }))
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(generateMultipartPartPresignedUrl).not.toHaveBeenCalled()
  })

  it('rejects a key that contains ".." even under the courses/ prefix', async () => {
    const res = await POST(request({
      action: 'sign-parts',
      key: 'courses/course-1/../../other-course/video/file.mp4',
      uploadId: 'a-valid-upload-id',
      partNumbers: [1],
    }))
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(generateMultipartPartPresignedUrl).not.toHaveBeenCalled()
  })

  it('rejects duplicate part numbers when signing parts', async () => {
    const res = await POST(request({
      action: 'sign-parts',
      key: 'courses/course-1/video/file.mp4',
      uploadId: 'a-valid-upload-id',
      partNumbers: [1, 1],
    }))
    expect(res.status).toBe(500)
    expect(generateMultipartPartPresignedUrl).not.toHaveBeenCalled()
  })

  it('rejects completion when a part is missing its ETag', async () => {
    const res = await POST(request({
      action: 'complete',
      key: 'courses/course-1/video/file.mp4',
      uploadId: 'a-valid-upload-id',
      parts: [{ partNumber: 1 }],
    }))
    expect(res.status).toBe(500)
    expect(completeMultipartUpload).not.toHaveBeenCalled()
  })

  it('completes an upload when all parts carry a valid ETag', async () => {
    const res = await POST(request({
      action: 'complete',
      key: 'courses/course-1/video/file.mp4',
      uploadId: 'a-valid-upload-id',
      parts: [{ partNumber: 2, eTag: 'etag-2' }, { partNumber: 1, eTag: 'etag-1' }],
    }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(completeMultipartUpload).toHaveBeenCalledWith(
      'courses/course-1/video/file.mp4',
      'a-valid-upload-id',
      [{ PartNumber: 1, ETag: 'etag-1' }, { PartNumber: 2, ETag: 'etag-2' }]
    )
  })
})

import { MAX_VIDEO_BYTES, getMultipartPartSize, validateVideoUpload } from '@/lib/video-upload'

describe('video upload limits', () => {
  it('accepts videos up to 10 GiB and rejects larger files', () => {
    expect(validateVideoUpload({ fileName: 'curso.mp4', fileSize: MAX_VIDEO_BYTES, contentType: 'video/mp4' })).toEqual({ valid: true })
    expect(validateVideoUpload({ fileName: 'curso.mp4', fileSize: MAX_VIDEO_BYTES + 1, contentType: 'video/mp4' })).toEqual({ valid: false, error: 'El video supera el máximo de 10 GB.' })
  })

  it('uses R2-compatible multipart parts without exceeding 10,000 parts', () => {
    const partSize = getMultipartPartSize(MAX_VIDEO_BYTES)
    expect(partSize).toBeGreaterThanOrEqual(5 * 1024 * 1024)
    expect(Math.ceil(MAX_VIDEO_BYTES / partSize)).toBeLessThanOrEqual(10_000)
  })

  it('rejects unsupported video formats before starting an upload', () => {
    expect(validateVideoUpload({ fileName: 'curso.avi', fileSize: 10, contentType: 'video/x-msvideo' })).toEqual({ valid: false, error: 'Formato no permitido. Usá MP4, WebM, MOV o MPEG.' })
  })
})

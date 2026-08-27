export const MEBIBYTE = 1024 * 1024
export const GIBIBYTE = 1024 * MEBIBYTE
export const MAX_VIDEO_BYTES = 10 * GIBIBYTE
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg'] as const

const DEFAULT_MULTIPART_PART_SIZE = 16 * MEBIBYTE
const R2_MIN_MULTIPART_PART_SIZE = 5 * MEBIBYTE
const R2_MAX_MULTIPART_PARTS = 10_000

export function getMultipartPartSize(fileSize: number) {
  const minimumForPartCount = Math.ceil(fileSize / R2_MAX_MULTIPART_PARTS)
  const roundedToR2Minimum = Math.ceil(minimumForPartCount / R2_MIN_MULTIPART_PART_SIZE) * R2_MIN_MULTIPART_PART_SIZE
  return Math.max(DEFAULT_MULTIPART_PART_SIZE, roundedToR2Minimum)
}

export function validateVideoUpload({ fileName, fileSize, contentType }: { fileName: string; fileSize: number; contentType: string }) {
  if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0) return { valid: false as const, error: 'Seleccioná un video válido.' }
  if (fileSize > MAX_VIDEO_BYTES) return { valid: false as const, error: 'El video supera el máximo de 10 GB.' }
  if (!(ALLOWED_VIDEO_TYPES as readonly string[]).includes(contentType)) return { valid: false as const, error: 'Formato no permitido. Usá MP4, WebM, MOV o MPEG.' }
  return { valid: true as const }
}

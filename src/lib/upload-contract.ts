export type UploadType = 'video' | 'resource'
export type LearningUploadScope = 'COURSE' | 'MODULE' | 'STYLE' | 'LESSON'

export const MB = 1024 * 1024
export const RESOURCE_MAX_BYTES = 100 * MB
export const VIDEO_MAX_BYTES = 3 * 1024 * MB

const SIZE_LIMITS: Record<UploadType, number> = {
  resource: RESOURCE_MAX_BYTES,
  video: VIDEO_MAX_BYTES,
}

export class UploadContractError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400
  ) {
    super(message)
    this.name = 'UploadContractError'
  }
}

export function parseUploadType(value: unknown): UploadType {
  if (value !== 'video' && value !== 'resource') {
    throw new UploadContractError('El tipo de carga no es válido.', 'INVALID_UPLOAD_TYPE')
  }
  return value
}

export function assertValidUploadFileSize(uploadType: UploadType, fileSize: unknown) {
  if (typeof fileSize !== 'number' || !Number.isFinite(fileSize) || !Number.isInteger(fileSize) || fileSize <= 0) {
    throw new UploadContractError('El tamaño del archivo debe ser un número entero mayor que cero.', 'INVALID_FILE_SIZE')
  }

  if (fileSize > SIZE_LIMITS[uploadType]) {
    const limitLabel = uploadType === 'video' ? '3 GB' : '100 MB'
    throw new UploadContractError(`El archivo es demasiado grande. Máximo ${limitLabel}.`, 'FILE_TOO_LARGE')
  }
}

export function parseLearningUploadScope(value: unknown): LearningUploadScope {
  if (value !== 'COURSE' && value !== 'MODULE' && value !== 'STYLE' && value !== 'LESSON') {
    throw new UploadContractError('El contexto del recurso no es válido.', 'INVALID_RESOURCE_SCOPE')
  }
  return value
}

export function assertDeferredPersistenceMetadata(input: {
  deferPersistence: unknown
  uploadType: UploadType
  courseId: unknown
  learningScope: unknown
  learningScopeId: unknown
}) {
  if (input.deferPersistence === undefined || input.deferPersistence === false) return null
  if (input.deferPersistence !== true) {
    throw new UploadContractError('El modo de persistencia no es válido.', 'INVALID_PERSISTENCE_MODE')
  }
  if (input.uploadType !== 'resource') {
    throw new UploadContractError('La persistencia diferida solo está disponible para recursos.', 'INVALID_PERSISTENCE_MODE')
  }
  if (typeof input.courseId !== 'string' || !input.courseId.trim()) {
    throw new UploadContractError('Falta el curso del recurso.', 'INVALID_RESOURCE_TARGET')
  }
  if (typeof input.learningScopeId !== 'string' || !input.learningScopeId.trim()) {
    throw new UploadContractError('Falta el destino del recurso.', 'INVALID_RESOURCE_TARGET')
  }

  return {
    courseId: input.courseId,
    learningScope: parseLearningUploadScope(input.learningScope),
    learningScopeId: input.learningScopeId,
  }
}

export function buildUploadRequestMetadata(
  file: { name: string; size: number; type: string },
  context: {
    uploadType: UploadType
    moduleId?: string
    lessonId?: string
    courseId?: string
    deferPersistence?: boolean
    learningScope?: LearningUploadScope
    learningScopeId?: string
  }
) {
  return {
    contentType: file.type,
    fileSize: file.size,
    uploadType: context.uploadType,
    moduleId: context.moduleId,
    lessonId: context.lessonId,
    courseId: context.courseId,
    fileName: file.name,
    deferPersistence: context.deferPersistence,
    learningScope: context.learningScope,
    learningScopeId: context.learningScopeId,
  }
}

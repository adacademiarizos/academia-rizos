import { LearningScope } from '@prisma/client'
import {
  assertDeferredPersistenceMetadata,
  UploadContractError,
  type UploadType,
} from '@/lib/upload-contract'
import { LearningContentError, resolveScopeTarget } from '@/server/services/learning-content-service'

export async function assertDeferredResourceUploadTarget(input: {
  deferPersistence: unknown
  uploadType: UploadType
  courseId: unknown
  learningScope: unknown
  learningScopeId: unknown
}) {
  const metadata = assertDeferredPersistenceMetadata(input)
  if (!metadata) return null

  let target
  try {
    target = await resolveScopeTarget({
      scope: metadata.learningScope as LearningScope,
      scopeId: metadata.learningScopeId,
    })
  } catch (error) {
    if (error instanceof LearningContentError) {
      throw new UploadContractError(error.message, error.code, error.status)
    }
    throw error
  }

  if (target.courseId !== metadata.courseId) {
    throw new UploadContractError(
      'El destino del recurso no pertenece al curso indicado.',
      'RESOURCE_TARGET_MISMATCH'
    )
  }

  return target
}

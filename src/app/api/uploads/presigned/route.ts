/**
 * POST /api/uploads/presigned
 * Generates a presigned PUT URL so the client can upload large files (videos up to 3GB)
 * directly to R2, bypassing Vercel's 4.5MB body size limit.
 *
 * Flow:
 *  1. Client POSTs file metadata here → gets { presignedUrl, fileUrl, key }
 *  2. Client PUTs the file directly to presignedUrl (no Vercel involvement)
 *  3. Client POSTs to /api/uploads/confirm to save the URL in the DB
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { generateUploadPresignedUrl, StorageConfigurationError } from '@/lib/storage'
import {
  assertValidUploadFileSize,
  parseUploadType,
  UploadContractError,
} from '@/lib/upload-contract'
import { assertDeferredResourceUploadTarget } from '@/server/services/resource-upload-contract-service'
import { nanoid } from 'nanoid'

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg']
const ALLOWED_RESOURCE_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'text/plain',
]

export async function POST(req: NextRequest) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  try {
    const { contentType, fileSize, uploadType: rawUploadType, moduleId, lessonId, courseId, fileName, deferPersistence, learningScope, learningScopeId } =
      await req.json()

    if (!contentType || !rawUploadType || !fileName) {
      return NextResponse.json(
        { ok: false, error: 'contentType, uploadType, and fileName are required' },
        { status: 400 }
      )
    }

    const uploadType = parseUploadType(rawUploadType)
    assertValidUploadFileSize(uploadType, fileSize)
    await assertDeferredResourceUploadTarget({ deferPersistence, uploadType, courseId, learningScope, learningScopeId })

    // Validate content type
    const allowedTypes = uploadType === 'video' ? ALLOWED_VIDEO_TYPES : ALLOWED_RESOURCE_TYPES
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        { ok: false, error: `Tipo de archivo no permitido: ${contentType}` },
        { status: 400 }
      )
    }

    // Build storage key
    const ext = fileName.split('.').pop() ?? (uploadType === 'video' ? 'mp4' : 'bin')
    const folder =
      lessonId && lessonId !== 'temp' ? `lessons/${lessonId}/video`
      : moduleId && moduleId !== 'temp' ? `modules/${moduleId}/video`
      : moduleId === 'temp' ? `courses/${courseId ?? 'temp'}/video`
      : `uploads/${uploadType}`
    const key = `${folder}/${Date.now()}-${nanoid(8)}.${ext}`

    // Generate presigned PUT URL (1 hour expiry — enough for large uploads)
    const presignedUrl = await generateUploadPresignedUrl(key, contentType, 3600)

    // Build the final public URL the client should store after upload
    const publicBase = process.env.R2_PUBLIC_URL
    const endpoint = process.env.R2_ENDPOINT
    const bucketName = process.env.R2_BUCKET_NAME
    const fileUrl = publicBase
      ? `${publicBase.replace(/\/$/, '')}/${key}`
      : `${endpoint}/${bucketName}/${key}`

    return NextResponse.json({ ok: true, data: { presignedUrl, fileUrl, key } })
  } catch (error) {
    if (error instanceof UploadContractError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status })
    }
    console.error('[presigned upload] error:', error)
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json(
        { ok: false, error: 'Cloudflare R2 no está configurado para subir videos o recursos.' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { ok: false, error: 'Failed to generate upload URL' },
      { status: 500 }
    )
  }
}

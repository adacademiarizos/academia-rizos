import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { checkAdminAuth } from '@/lib/admin-auth'
import { abortMultipartUpload, completeMultipartUpload, createMultipartUpload, generateMultipartPartPresignedUrl, getPublicFileUrl, StorageConfigurationError } from '@/lib/storage'
import { getMultipartPartSize, validateVideoUpload } from '@/lib/video-upload'

const MAX_PARTS = 10_000

function ensureVideoKey(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('courses/') || value.includes('..')) throw new Error('Identificador de carga inválido.')
  return value
}

function ensureUploadId(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 512) throw new Error('Sesión de carga inválida.')
  return value
}

function ensurePartNumber(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > MAX_PARTS) throw new Error('Número de parte inválido.')
  return value as number
}

export async function POST(request: NextRequest) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  try {
    const body = await request.json()

    if (body.action === 'create') {
      const validation = validateVideoUpload({ fileName: body.fileName, fileSize: body.fileSize, contentType: body.contentType })
      if (!validation.valid) return NextResponse.json({ ok: false, error: validation.error }, { status: 400 })
      if (typeof body.courseId !== 'string' || !body.courseId) return NextResponse.json({ ok: false, error: 'Curso inválido.' }, { status: 400 })

      const extension = body.fileName.split('.').pop()?.toLowerCase() || 'mp4'
      const key = `courses/${body.courseId}/video/${Date.now()}-${nanoid(8)}.${extension}`
      const uploadId = await createMultipartUpload(key, body.contentType)
      const partSize = getMultipartPartSize(body.fileSize)

      return NextResponse.json({ ok: true, data: {
        uploadId,
        key,
        fileUrl: getPublicFileUrl(key),
        partSize,
        partCount: Math.ceil(body.fileSize / partSize),
      } })
    }

    const key = ensureVideoKey(body.key)
    const uploadId = ensureUploadId(body.uploadId)

    if (body.action === 'sign-parts') {
      if (!Array.isArray(body.partNumbers) || body.partNumbers.length === 0 || body.partNumbers.length > 16) throw new Error('Partes de carga inválidas.')
      const partNumbers: number[] = body.partNumbers.map(ensurePartNumber)
      if (new Set(partNumbers).size !== partNumbers.length) throw new Error('Las partes de carga están repetidas.')
      const parts = await Promise.all(partNumbers.map(async (partNumber) => ({ partNumber, presignedUrl: await generateMultipartPartPresignedUrl(key, uploadId, partNumber) })))
      return NextResponse.json({ ok: true, data: { parts } })
    }

    if (body.action === 'complete') {
      if (!Array.isArray(body.parts) || body.parts.length === 0 || body.parts.length > MAX_PARTS) throw new Error('Partes de carga inválidas.')
      const parts = body.parts.map((part: unknown) => {
        if (!part || typeof part !== 'object') throw new Error('Parte de carga inválida.')
        const value = part as { partNumber?: unknown; eTag?: unknown }
        if (typeof value.eTag !== 'string' || !value.eTag) throw new Error('La respuesta de R2 no incluyó el ETag de una parte.')
        return { PartNumber: ensurePartNumber(value.partNumber), ETag: value.eTag }
      }).sort((first: { PartNumber: number }, second: { PartNumber: number }) => first.PartNumber - second.PartNumber)
      if (new Set(parts.map((part: { PartNumber: number }) => part.PartNumber)).size !== parts.length) throw new Error('Las partes de carga están repetidas.')
      await completeMultipartUpload(key, uploadId, parts)
      return NextResponse.json({ ok: true, data: { fileUrl: getPublicFileUrl(key) } })
    }

    if (body.action === 'abort') {
      await abortMultipartUpload(key, uploadId)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: false, error: 'Acción de carga inválida.' }, { status: 400 })
  } catch (error) {
    console.error('[multipart video upload] error:', error)
    const message = error instanceof StorageConfigurationError
      ? 'Cloudflare R2 no está configurado para subir videos.'
      : error instanceof Error ? error.message : 'No se pudo preparar la carga del video.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

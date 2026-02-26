/**
 * POST /api/uploads/confirm
 * Called after the client has successfully uploaded a file directly to R2 via presigned URL.
 * Updates the database with the file URL (same logic as the old /api/uploads route).
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  try {
    const { fileUrl, fileName, fileSize, mimeType, uploadType, moduleId, lessonId, courseId } =
      await req.json()

    if (!fileUrl || !uploadType) {
      return NextResponse.json(
        { ok: false, error: 'fileUrl and uploadType are required' },
        { status: 400 }
      )
    }

    // Determine DB file type label
    let fileType = 'other'
    if (mimeType === 'application/pdf') fileType = 'pdf'
    else if (mimeType?.startsWith('image/')) fileType = 'image'
    else if (mimeType?.startsWith('video/')) fileType = 'video'
    else if (mimeType?.includes('word') || mimeType?.includes('wordprocessingml')) fileType = 'document'
    else if (mimeType?.includes('sheet') || mimeType?.includes('spreadsheetml')) fileType = 'document'

    // Update DB
    if (uploadType === 'video') {
      if (lessonId && lessonId !== 'temp') {
        await db.lesson.update({ where: { id: lessonId }, data: { videoFileUrl: fileUrl } })
      } else if (moduleId && moduleId !== 'temp') {
        await db.module.update({ where: { id: moduleId }, data: { videoFileUrl: fileUrl } })
      }
      // If lessonId/moduleId is 'temp', the caller stores the URL locally until the entity is saved

      // Trigger transcription in background (non-blocking)
      if (process.env.INTERNAL_TRANSCRIBE_SECRET) {
        const target =
          lessonId && lessonId !== 'temp' ? { lessonId }
          : moduleId && moduleId !== 'temp' ? { moduleId }
          : null
        if (target) {
          const baseUrl = req.nextUrl.origin
          fetch(`${baseUrl}/api/ai/transcribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': process.env.INTERNAL_TRANSCRIBE_SECRET,
            },
            body: JSON.stringify(target),
          }).catch((err: unknown) => console.error('Transcription trigger failed:', err))
        }
      }
    } else if (uploadType === 'resource') {
      if (moduleId && moduleId !== 'temp') {
        await db.moduleResource.create({
          data: {
            moduleId,
            title: fileName ?? 'Recurso',
            fileUrl,
            fileType,
            fileSize: fileSize ?? 0,
            order: 0,
          },
        })
      } else if (courseId) {
        await db.courseResource.create({
          data: {
            courseId,
            title: fileName ?? 'Recurso',
            fileUrl,
            fileType,
            fileSize: fileSize ?? 0,
            order: 0,
          },
        })
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        fileUrl,
        fileName: fileName ?? '',
        fileSize: fileSize ?? 0,
        fileType,
        uploadedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[upload confirm] error:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to confirm upload' },
      { status: 500 }
    )
  }
}

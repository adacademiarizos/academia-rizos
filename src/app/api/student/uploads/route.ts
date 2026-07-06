/**
 * POST /api/student/uploads - File upload for student test answers
 * Used when answering FILE_UPLOAD questions (photos, videos of work)
 */

import { NextRequest, NextResponse } from 'next/server'
import { authorizeCourseAccessByCourseId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { uploadFile } from '@/lib/storage'

const MAX_FILE_SIZE = 100 * 1024 * 1024
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/mov',
  'application/pdf',
]

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const courseId = formData.get('courseId')

    if (typeof courseId !== 'string' || courseId.length === 0) {
      return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400 })
    }

    const access = await authorizeCourseAccessByCourseId(courseId, {
      allowAdmin: false,
      requireActiveAccess: true,
    })

    if (!access.ok) {
      return toAccessDeniedResponse(access)
    }

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'File type not allowed. Allowed: images, videos, PDFs' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 100 MB' },
        { status: 400 }
      )
    }

    const storagePath = `student-answers/${access.user.id}/${Date.now()}-${file.name}`
    const fileUrl = await uploadFile(storagePath, buffer, file.type)

    return NextResponse.json({
      success: true,
      data: {
        fileUrl,
        fileName: file.name,
        fileSize: buffer.length,
        fileType: file.type,
      },
    })
  } catch (error) {
    console.error('Student upload error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}

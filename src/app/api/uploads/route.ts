/**
 * POST /api/uploads - File upload handler for videos and resources
 * Uploads files to AWS S3/Cloudflare R2 and saves metadata to database
 *
 * Query params:
 * - type: 'video' | 'resource' (video = module video, resource = PDF/image/document)
 * - moduleId: (required for type=resource)
 * - courseId: (required for uploading course resources)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { uploadFile, validateFileSize, validateFileType, generateStorageKey } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin role
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { role: true, id: true },
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') // 'video' or 'resource'
    const moduleId = searchParams.get('moduleId')
    const lessonId = searchParams.get('lessonId')
    const courseId = searchParams.get('courseId')

    if (!type || !['video', 'resource'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid upload type. Must be "video" or "resource"' },
        { status: 400 }
      )
    }

    // Validate required parameters
    if (type === 'resource' && !moduleId && !courseId) {
      return NextResponse.json(
        { success: false, error: 'moduleId or courseId is required for resource uploads' },
        { status: 400 }
      )
    }

    if (type === 'video' && !moduleId && !lessonId) {
      return NextResponse.json(
        { success: false, error: 'moduleId or lessonId is required for video uploads' },
        { status: 400 }
      )
    }

    // "temp" moduleId is valid: used when uploading a video while creating a new module.
    // In that case we skip DB validation and DB update — the caller stores the returned URL.

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Identify file type for validation
    let fileCategory: 'video' | 'pdf' | 'image' | 'certificate' = 'pdf'
    const mimeType = file.type

    if (type === 'video') {
      fileCategory = 'video'
    } else if (mimeType.startsWith('image/')) {
      fileCategory = 'image'
    } else if (mimeType === 'application/pdf') {
      fileCategory = 'pdf'
    }

    // Validate file
    const buffer = Buffer.from(await file.arrayBuffer())
    validateFileSize(buffer.length, fileCategory)
    validateFileType(mimeType, fileCategory)

    // Determine storage path
    let storagePath = ''
    const storageType = type === 'video' ? 'video' : 'resource'

    if (type === 'video' && lessonId) {
      if (lessonId !== 'temp') {
        // Verify lesson exists
        const lesson = await db.lesson.findUnique({
          where: { id: lessonId },
          select: { moduleId: true },
        })
        if (!lesson) {
          return NextResponse.json(
            { success: false, error: 'Lesson not found' },
            { status: 404 }
          )
        }
      }
      storagePath = `lessons/${lessonId}/video/${Date.now()}-${file.name}`
    } else if (type === 'video' && moduleId) {
      if (moduleId !== 'temp') {
        // Verify module exists
        const module = await db.module.findUnique({
          where: { id: moduleId },
          select: { courseId: true },
        })

        if (!module) {
          return NextResponse.json(
            { success: false, error: 'Module not found' },
            { status: 404 }
          )
        }
      }

      // For "temp" use courseId folder if provided, otherwise "temp"
      const folder = moduleId !== 'temp' ? `modules/${moduleId}` : `courses/${courseId ?? 'temp'}`
      storagePath = `${folder}/${storageType}/${Date.now()}-${file.name}`
    } else if (type === 'resource' && (moduleId || courseId)) {
      if (moduleId) {
        storagePath = `modules/${moduleId}/${storageType}/${Date.now()}-${file.name}`
      } else if (courseId) {
        storagePath = `courses/${courseId}/${storageType}/${Date.now()}-${file.name}`
      }
    }

    // Upload to S3/R2
    const fileUrl = await uploadFile(storagePath, buffer, mimeType)

    // Determine file type for database
    let dbFileType = 'other'
    if (mimeType === 'application/pdf') {
      dbFileType = 'pdf'
    } else if (mimeType.startsWith('image/')) {
      dbFileType = 'image'
    } else if (mimeType.startsWith('video/')) {
      dbFileType = 'video'
    } else if (
      mimeType === 'application/msword' ||
      mimeType.includes('wordprocessingml') ||
      mimeType === 'application/vnd.ms-excel' ||
      mimeType.includes('spreadsheetml')
    ) {
      dbFileType = 'document'
    }

    // Save to database based on type
    if (type === 'video' && lessonId && lessonId !== 'temp') {
      // Update lesson with video URL
      await db.lesson.update({
        where: { id: lessonId },
        data: { videoFileUrl: fileUrl },
      })
    } else if (type === 'video' && moduleId && moduleId !== 'temp') {
      // Update existing module with video URL
      await db.module.update({
        where: { id: moduleId },
        data: { videoFileUrl: fileUrl },
      })
    } else if (type === 'resource' && moduleId && moduleId !== 'temp') {
      // Create module resource (skip if temp — caller will create record after module is saved)
      await db.moduleResource.create({
        data: {
          moduleId,
          title: file.name,
          fileUrl,
          fileType: dbFileType,
          fileSize: buffer.length,
          order: 0, // Will need to reorder if there are existing resources
        },
      })
    } else if (type === 'resource' && courseId) {
      // Create course resource
      await db.courseResource.create({
        data: {
          courseId,
          title: file.name,
          fileUrl,
          fileType: dbFileType,
          fileSize: buffer.length,
          order: 0,
        },
      })
    }

    // Fire-and-forget transcription: triggered after video is saved to DB
    if (type === 'video' && process.env.INTERNAL_TRANSCRIBE_SECRET) {
      const transcribeTarget =
        lessonId && lessonId !== 'temp' ? { lessonId } :
        moduleId && moduleId !== 'temp' ? { moduleId } :
        null

      if (transcribeTarget) {
        const baseUrl = request.nextUrl.origin
        fetch(`${baseUrl}/api/ai/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': process.env.INTERNAL_TRANSCRIBE_SECRET,
          },
          body: JSON.stringify(transcribeTarget),
        }).catch((err: unknown) => {
          console.error('Failed to trigger transcription:', err)
        })
        // No await — upload response returns immediately while transcription runs in background
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        fileUrl,
        fileName: file.name,
        fileSize: buffer.length,
        fileType: dbFileType,
        uploadedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Upload error:', error)

    if (error instanceof Error) {
      // Check if it's a validation error
      if (error.message.includes('File too large') || error.message.includes('Invalid file type')) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload file',
      },
      { status: 500 }
    )
  }
}

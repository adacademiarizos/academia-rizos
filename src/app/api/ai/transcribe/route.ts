import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { transcribeVideoUrl } from '@/lib/transcription'
import { getSignedDownloadUrl } from '@/lib/storage'
import { extractKeyFromUrl } from '@/lib/transcription'

export const maxDuration = 300
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Auth: accept ADMIN session OR internal secret header
    const internalSecret = request.headers.get('x-internal-secret')
    const isInternalCall =
      internalSecret != null &&
      internalSecret === process.env.INTERNAL_TRANSCRIBE_SECRET

    if (!isInternalCall) {
      const session = await getServerSession()
      if (!session?.user?.email) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }
      const user = await db.user.findUnique({
        where: { email: session.user.email },
        select: { role: true },
      })
      if (user?.role !== 'ADMIN') {
        return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
      }
    }

    const body = await request.json()
    const { moduleId, lessonId } = body as { moduleId?: string; lessonId?: string }

    if (!moduleId && !lessonId) {
      return NextResponse.json(
        { success: false, error: 'moduleId or lessonId is required' },
        { status: 400 }
      )
    }

    // Get the video URL from DB
    let videoFileUrl: string | null = null

    if (lessonId) {
      const lesson = await db.lesson.findUnique({
        where: { id: lessonId },
        select: { videoFileUrl: true, videoUrl: true },
      })
      if (!lesson) {
        return NextResponse.json({ success: false, error: 'Lesson not found' }, { status: 404 })
      }
      videoFileUrl = lesson.videoFileUrl || lesson.videoUrl
    } else if (moduleId) {
      const module = await db.module.findUnique({
        where: { id: moduleId },
        select: { videoFileUrl: true, videoUrl: true },
      })
      if (!module) {
        return NextResponse.json({ success: false, error: 'Module not found' }, { status: 404 })
      }
      videoFileUrl = module.videoFileUrl || module.videoUrl
    }

    if (!videoFileUrl) {
      return NextResponse.json(
        { success: false, error: 'No video URL found. Upload a video first.' },
        { status: 400 }
      )
    }

    // Try to get a signed URL for private buckets; fall back to public URL
    let downloadUrl = videoFileUrl
    const storageKey = extractKeyFromUrl(videoFileUrl)
    if (storageKey) {
      try {
        downloadUrl = await getSignedDownloadUrl(storageKey, 3600)
      } catch {
        // Bucket is public — use the URL directly
        downloadUrl = videoFileUrl
      }
    }

    // Run transcription (may take 30–300 seconds for long videos)
    const transcript = await transcribeVideoUrl(downloadUrl)

    // Save transcript to DB
    if (lessonId) {
      await db.lesson.update({ where: { id: lessonId }, data: { transcript } })
    } else if (moduleId) {
      await db.module.update({ where: { id: moduleId }, data: { transcript } })
    }

    return NextResponse.json({
      success: true,
      data: {
        transcript,
        transcriptLength: transcript.length,
        target: lessonId ? `lesson:${lessonId}` : `module:${moduleId}`,
      },
    })
  } catch (error) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Transcription failed',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/chat/images
 * Upload a chat image (max 3 MB, images only)
 * Returns a public URL stored in S3/R2
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { uploadFile } from '@/lib/storage'

const MAX_SIZE = 3 * 1024 * 1024 // 3 MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Solo se permiten imágenes (JPEG, PNG, GIF, WebP)' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (buffer.length > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'La imagen no puede superar 3 MB' },
        { status: 400 }
      )
    }

    const storagePath = `chat-images/${user.id}/${Date.now()}-${file.name}`
    const imageUrl = await uploadFile(storagePath, buffer, file.type)

    return NextResponse.json({ success: true, data: { imageUrl } })
  } catch (error) {
    console.error('Chat image upload error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}

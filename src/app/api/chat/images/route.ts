/**
 * POST /api/chat/images
 * Upload a chat image (max 3 MB, images only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { authorizeChatRoomAccessByRoomId, toAccessDeniedResponse } from '@/lib/course-access-control'
import { uploadFile } from '@/lib/storage'

const MAX_SIZE = 3 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const roomId = formData.get('roomId')

    if (typeof roomId !== 'string' || roomId.length === 0) {
      return NextResponse.json({ success: false, error: 'roomId is required' }, { status: 400 })
    }

    const access = await authorizeChatRoomAccessByRoomId(roomId, {
      allowAdmin: true,
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
        { success: false, error: 'Solo se permiten imagenes (JPEG, PNG, GIF, WebP)' },
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

    const storagePath = `chat-images/${access.user.id}/${Date.now()}-${file.name}`
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

/**
 * POST /api/me/avatar
 * Upload the caller's profile picture (images only, max 3 MB) and return its
 * public URL. Mirrors api/chat/images/route.ts: the file goes straight to
 * storage and the caller persists the URL through PATCH /api/me/profile.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'
import { uploadFile } from '@/lib/storage'

const MAX_SIZE = 3 * 1024 * 1024 // 3 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Debes iniciar sesión' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { id: true, deletedAt: true },
    })

    if (!user || user.deletedAt) {
      return NextResponse.json({ success: false, error: 'Debes iniciar sesión' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'No se recibió ninguna imagen' }, { status: 400 })
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

    const storagePath = `avatars/${user.id}/${Date.now()}-${file.name}`
    const imageUrl = await uploadFile(storagePath, buffer, file.type)

    return NextResponse.json({ success: true, data: { imageUrl } })
  } catch (error) {
    console.error('Avatar upload error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'No se pudo subir la imagen' },
      { status: 500 }
    )
  }
}

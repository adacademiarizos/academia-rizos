import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { slugifyStyleName } from '@/lib/academy-content'

const UpdateStyleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

async function getUniqueStyleSlug(moduleId: string, name: string, styleId: string) {
  const baseSlug = slugifyStyleName(name)
  let slug = baseSlug
  let suffix = 2

  while (true) {
    const existing = await db.moduleStyle.findUnique({
      where: { moduleId_slug: { moduleId, slug } },
      select: { id: true },
    })
    if (!existing || existing.id === styleId) return slug
    slug = `${baseSlug}-${suffix}`
    suffix++
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string; styleId: string }> }
) {
  try {
    const auth = await checkAdminAuth()
    if (!auth.authorized) return auth.response

    const { moduleId, styleId } = await params

    const existing = await db.moduleStyle.findUnique({
      where: { id: styleId },
      select: { id: true, moduleId: true },
    })

    if (!existing || existing.moduleId !== moduleId) {
      return NextResponse.json({ success: false, error: 'Style not found' }, { status: 404 })
    }

    const body = await request.json()
    const data = UpdateStyleSchema.parse(body)
    const slug = data.name ? await getUniqueStyleSlug(moduleId, data.name, styleId) : undefined

    const updated = await db.moduleStyle.update({
      where: { id: styleId },
      data: {
        ...(data.name !== undefined && { name: data.name, slug }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating module style:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update style' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ moduleId: string; styleId: string }> }
) {
  try {
    const auth = await checkAdminAuth()
    if (!auth.authorized) return auth.response

    const { moduleId, styleId } = await params

    const existing = await db.moduleStyle.findUnique({
      where: { id: styleId },
      select: { id: true, moduleId: true, name: true },
    })

    if (!existing || existing.moduleId !== moduleId) {
      return NextResponse.json({ success: false, error: 'Style not found' }, { status: 404 })
    }

    const styleCount = await db.moduleStyle.count({ where: { moduleId } })
    if (styleCount <= 1) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete the only style in a module' },
        { status: 400 }
      )
    }

    await db.moduleStyle.delete({ where: { id: styleId } })

    return NextResponse.json({
      success: true,
      data: { id: styleId, name: existing.name, message: 'Style deleted successfully' },
    })
  } catch (error) {
    console.error('Error deleting module style:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete style' },
      { status: 500 }
    )
  }
}

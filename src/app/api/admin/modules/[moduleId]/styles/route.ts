import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import { getNextStyleOrder, slugifyStyleName } from '@/lib/academy-content'

const CreateStyleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

async function getUniqueStyleSlug(moduleId: string, name: string) {
  const baseSlug = slugifyStyleName(name)
  let slug = baseSlug
  let suffix = 2

  while (await db.moduleStyle.findUnique({ where: { moduleId_slug: { moduleId, slug } } })) {
    slug = `${baseSlug}-${suffix}`
    suffix++
  }

  return slug
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const auth = await checkAdminAuth()
    if (!auth.authorized) return auth.response

    const { moduleId } = await params

    const courseModule = await db.module.findUnique({
      where: { id: moduleId },
      select: { id: true },
    })

    if (!courseModule) {
      return NextResponse.json({ success: false, error: 'Module not found' }, { status: 404 })
    }

    const styles = await db.moduleStyle.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
      include: {
        lessons: { orderBy: { order: 'asc' } },
      },
    })

    return NextResponse.json({ success: true, data: styles })
  } catch (error) {
    console.error('Error fetching module styles:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch styles' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const auth = await checkAdminAuth()
    if (!auth.authorized) return auth.response

    const { moduleId } = await params

    const courseModule = await db.module.findUnique({
      where: { id: moduleId },
      select: { id: true },
    })

    if (!courseModule) {
      return NextResponse.json({ success: false, error: 'Module not found' }, { status: 404 })
    }

    const body = await request.json()
    const data = CreateStyleSchema.parse(body)
    const order = data.order ?? (await getNextStyleOrder(moduleId))
    const slug = await getUniqueStyleSlug(moduleId, data.name)

    const style = await db.moduleStyle.create({
      data: {
        moduleId,
        order,
        name: data.name,
        slug,
        description: data.description ?? null,
        isActive: data.isActive ?? true,
      },
    })

    return NextResponse.json({ success: true, data: style }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating module style:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create style' },
      { status: 500 }
    )
  }
}

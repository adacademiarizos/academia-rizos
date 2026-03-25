import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'

type TestimonialType = 'SALON' | 'ACADEMIA'
const MISSING_TYPE_MIGRATION_MESSAGE =
  'La base de datos no tiene el campo "type" de testimonios. Ejecuta "npx prisma migrate deploy".'

function parseTestimonialType(raw: unknown): TestimonialType | null {
  if (raw === 'SALON' || raw === 'ACADEMIA') return raw
  return null
}

function getTestimonialsErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
    const missingColumn = String(error.meta?.column ?? '').toLowerCase()
    if (missingColumn.includes('testimonial') && missingColumn.includes('type')) {
      return MISSING_TYPE_MIGRATION_MESSAGE
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes('testimonial') && message.includes('type') && message.includes('column')) {
      return MISSING_TYPE_MIGRATION_MESSAGE
    }
  }

  return fallback
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  try {
    const { id } = await params
    const body = await req.json()
    const { name, role, quote, stars, avatarUrl, isActive, order, type } = body
    const parsedType = type === undefined ? undefined : parseTestimonialType(type)

    if (type !== undefined && !parsedType) {
      return NextResponse.json(
        { ok: false, error: 'Tipo de testimonio invalido' },
        { status: 400 }
      )
    }

    const testimonial = await db.testimonial.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(role !== undefined && { role }),
        ...(quote !== undefined && { quote }),
        ...(parsedType && { type: parsedType }),
        ...(stars !== undefined && { stars: Math.min(5, Math.max(1, parseInt(stars) || 5)) }),
        ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
        ...(isActive !== undefined && { isActive }),
        ...(order !== undefined && { order }),
      },
    })

    return NextResponse.json({ ok: true, data: testimonial })
  } catch (error) {
    console.error('Error updating testimonial:', error)
    return NextResponse.json(
      { ok: false, error: getTestimonialsErrorMessage(error, 'Error al actualizar testimonio') },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  try {
    const { id } = await params
    await db.testimonial.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting testimonial:', error)
    return NextResponse.json(
      { ok: false, error: getTestimonialsErrorMessage(error, 'Error al eliminar testimonio') },
      { status: 500 }
    )
  }
}

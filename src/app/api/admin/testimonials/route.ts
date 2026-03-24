import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { db } from '@/lib/db'

type TestimonialType = 'SALON' | 'ACADEMIA'

function parseTestimonialType(raw: unknown): TestimonialType | null {
  if (raw === 'SALON' || raw === 'ACADEMIA') return raw
  return null
}

export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  const filterType = parseTestimonialType(req.nextUrl.searchParams.get('type'))
  const testimonials = await db.testimonial.findMany({
    where: filterType ? { type: filterType } : undefined,
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json({ ok: true, data: testimonials })
}

export async function POST(req: NextRequest) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  try {
    const body = await req.json()
    const { name, role, quote, stars, avatarUrl, type } = body

    if (!name || !quote) {
      return NextResponse.json(
        { ok: false, error: 'Nombre y testimonio son requeridos' },
        { status: 400 }
      )
    }

    const testimonialType = parseTestimonialType(type) ?? 'SALON'

    const maxOrder = await db.testimonial.aggregate({
      where: { type: testimonialType },
      _max: { order: true },
    })
    const testimonial = await db.testimonial.create({
      data: {
        name,
        role: role || 'Clienta',
        quote,
        type: testimonialType,
        stars: Math.min(5, Math.max(1, parseInt(stars) || 5)),
        avatarUrl: avatarUrl || null,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    })

    return NextResponse.json({ ok: true, data: testimonial }, { status: 201 })
  } catch (error) {
    console.error('Error creating testimonial:', error)
    return NextResponse.json(
      { ok: false, error: 'Error al crear testimonio' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

type TestimonialScope = 'home' | 'salon' | 'academia'

function parseScope(raw: string | null): TestimonialScope {
  if (raw === 'salon' || raw === 'academia' || raw === 'home') return raw
  return 'home'
}

export async function GET(req: NextRequest) {
  const scope = parseScope(req.nextUrl.searchParams.get('scope'))

  const testimonials = await db.testimonial.findMany({
    where:
      scope === 'salon'
        ? { isActive: true, type: 'SALON' }
        : scope === 'academia'
          ? { isActive: true, type: 'ACADEMIA' }
          : { isActive: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      role: true,
      quote: true,
      stars: true,
      avatarUrl: true,
    },
  })
  return NextResponse.json({ ok: true, data: testimonials })
}

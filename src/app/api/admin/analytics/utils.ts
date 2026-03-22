import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/admin-auth'

export function parseDateRange(url: URL) {
  const fromStr = url.searchParams.get('from')
  const toStr = url.searchParams.get('to')

  const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const to = toStr ? new Date(toStr) : new Date()

  // Validate dates
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return { error: 'Fechas inválidas. Use formato YYYY-MM-DD.' }
  }

  return { from, to }
}

export async function withAnalyticsAuth(
  req: NextRequest,
  handler: (params: { from: Date; to: Date; url: URL }) => Promise<any>
) {
  const auth = await checkAdminAuth()
  if (!auth.authorized) return auth.response

  try {
    const url = new URL(req.url)
    const range = parseDateRange(url)

    if ('error' in range) {
      return NextResponse.json({ ok: false, error: range.error }, { status: 400 })
    }

    const data = await handler({ from: range.from, to: range.to, url })
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error('[analytics] API error:', error)
    return NextResponse.json(
      { ok: false, error: 'Error al procesar la solicitud de analíticas' },
      { status: 500 }
    )
  }
}

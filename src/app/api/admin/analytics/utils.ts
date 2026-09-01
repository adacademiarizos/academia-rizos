import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/admin-auth'
import { parseAnalyticsDateRange } from '@/lib/analytics/date-range'

export function parseDateRange(url: URL) {
  const range = parseAnalyticsDateRange(
    url.searchParams.get('from'),
    url.searchParams.get('to')
  )

  if (!range.ok) return { error: range.error }
  return { from: range.value.from, to: range.value.to }
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

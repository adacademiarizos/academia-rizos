import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function parseUserAgent(ua: string) {
  let deviceType = 'desktop'
  if (/mobile|android|iphone|ipod|phone/i.test(ua)) deviceType = 'mobile'
  else if (/tablet|ipad/i.test(ua)) deviceType = 'tablet'

  let browser = 'Other'
  if (/edg\//i.test(ua)) browser = 'Edge'
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = 'Opera'
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome'
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari'
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox'

  let os = 'Other'
  if (/windows/i.test(ua)) os = 'Windows'
  else if (/macintosh|mac os/i.test(ua)) os = 'macOS'
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS'
  else if (/android/i.test(ua)) os = 'Android'
  else if (/linux/i.test(ua)) os = 'Linux'

  return { deviceType, browser, os }
}

// Truncate string to max length for safety
function truncate(val: unknown, max: number): string | null {
  if (typeof val !== 'string' || !val) return null
  return val.slice(0, max)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { path, referrer, sessionId, utmSource, utmMedium, utmCampaign, utmContent, utmTerm } = body

    if (!sessionId || !path || typeof sessionId !== 'string' || typeof path !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    // Validate field lengths to prevent abuse
    if (sessionId.length > 100 || path.length > 500) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const ua = req.headers.get('user-agent') || ''
    const { deviceType, browser, os } = parseUserAgent(ua)

    // Vercel provides geo headers automatically
    const country = req.headers.get('x-vercel-ip-country') || null
    const city = req.headers.get('x-vercel-ip-city') || null

    await db.pageView.create({
      data: {
        path: path.slice(0, 500),
        referrer: truncate(referrer, 1000),
        sessionId: sessionId.slice(0, 100),
        utmSource: truncate(utmSource, 200),
        utmMedium: truncate(utmMedium, 200),
        utmCampaign: truncate(utmCampaign, 200),
        utmContent: truncate(utmContent, 200),
        utmTerm: truncate(utmTerm, 200),
        deviceType,
        browser,
        os,
        country,
        city,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Analytics pageview error:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

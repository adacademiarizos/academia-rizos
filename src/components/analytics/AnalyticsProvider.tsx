'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { getAnalyticsConsent } from './CookieConsent'

const SESSION_COOKIE = 'ap_sid'
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function getSessionId(): string {
  // Read from cookie
  const match = document.cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`))
  if (match) return match[1]

  // Generate new session ID and set cookie (30 days)
  const id = generateId()
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${SESSION_COOKIE}=${id}; path=/; expires=${expires}; SameSite=Lax`
  return id
}

function captureUtmParams(searchParams: URLSearchParams) {
  const utmData: Record<string, string> = {}
  let hasUtm = false

  for (const key of UTM_KEYS) {
    const val = searchParams.get(key)
    if (val) {
      utmData[key] = val
      hasUtm = true
    }
  }

  // Store in sessionStorage (first-touch attribution within session)
  if (hasUtm) {
    sessionStorage.setItem('ap_utm', JSON.stringify(utmData))
  }

  // Return stored UTM data (first-touch)
  try {
    const stored = sessionStorage.getItem('ap_utm')
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function getStoredUtm(): Record<string, string> {
  try {
    const stored = sessionStorage.getItem('ap_utm')
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

export function getAnalyticsData() {
  if (typeof window === 'undefined') return null
  const sessionId = getSessionId()
  const utm = getStoredUtm()
  return {
    analyticsSessionId: sessionId,
    utmSource: utm.utm_source || '',
    utmMedium: utm.utm_medium || '',
    utmCampaign: utm.utm_campaign || '',
    referrer: document.referrer || '',
  }
}

export function AnalyticsProvider() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastPathRef = useRef<string>('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Check consent
    const consent = getAnalyticsConsent()
    if (consent !== true) return

    // Capture UTM params from URL on first load
    captureUtmParams(searchParams)
  }, [searchParams])

  useEffect(() => {
    // Check consent
    const consent = getAnalyticsConsent()
    if (consent !== true) return

    // Debounce to avoid duplicate entries on fast redirects
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      // Skip if same path (avoid double-fire)
      if (pathname === lastPathRef.current) return
      lastPathRef.current = pathname

      // Skip internal/admin pages — only track public-facing traffic
      if (pathname.startsWith('/admin') || pathname.startsWith('/staff') || pathname.startsWith('/api')) return

      const sessionId = getSessionId()
      const utm = getStoredUtm()

      const payload = JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
        sessionId,
        utmSource: utm.utm_source || null,
        utmMedium: utm.utm_medium || null,
        utmCampaign: utm.utm_campaign || null,
        utmContent: utm.utm_content || null,
        utmTerm: utm.utm_term || null,
      })

      // Fire-and-forget with sendBeacon (doesn't block navigation)
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/pageview', new Blob([payload], { type: 'application/json' }))
      } else {
        fetch('/api/analytics/pageview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {})
      }
    }, 100)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [pathname])

  return null
}

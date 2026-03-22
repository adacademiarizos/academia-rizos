'use client'

import { Suspense } from 'react'
import { SessionProvider } from 'next-auth/react'
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider'
import { CookieConsent } from '@/components/analytics/CookieConsent'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      {children}
      <Suspense fallback={null}>
        <AnalyticsProvider />
      </Suspense>
      <CookieConsent />
    </SessionProvider>
  )
}

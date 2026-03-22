import { Suspense } from 'react'
import { protectAdminPage } from '@/lib/protect-admin-page'
import { AnalyticsTabs } from './components/AnalyticsTabs'
import { DateRangePicker } from './components/DateRangePicker'

export const dynamic = 'force-dynamic'

export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await protectAdminPage()

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Analíticas de Marketing</h1>
        <p className="mt-1 text-sm text-white/50">
          Tráfico, fuentes, conversiones y rendimiento de campañas
        </p>
      </div>

      <Suspense fallback={null}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <AnalyticsTabs />
          <DateRangePicker />
        </div>
      </Suspense>

      <Suspense
        fallback={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 h-24 animate-pulse"
              />
            ))}
          </div>
        }
      >
        {children}
      </Suspense>
    </div>
  )
}

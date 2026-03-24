import { Suspense } from 'react'
import { protectAdminPage } from '@/lib/protect-admin-page'
import { LandingTabs } from './components/LandingTabs'

export const dynamic = 'force-dynamic'

export default async function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await protectAdminPage()

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Landing Page</h1>
        <p className="mt-1 text-sm text-white/50">
          Administra el contenido de la página principal: servicios, resultados, testimonios, FAQ y horarios.
        </p>
      </div>

      <Suspense fallback={null}>
        <LandingTabs />
      </Suspense>

      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 h-32 animate-pulse" />
        }
      >
        {children}
      </Suspense>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Overview', href: '/admin/analytics' },
  { label: 'Tráfico', href: '/admin/analytics/traffic' },
  { label: 'Campañas', href: '/admin/analytics/campaigns' },
  { label: 'Conversiones', href: '/admin/analytics/conversions' },
  { label: 'Cursos', href: '/admin/analytics/courses' },
  { label: 'Audiencia', href: '/admin/analytics/audience' },
]

export function AnalyticsTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
      {TABS.map((tab) => {
        const active =
          tab.href === '/admin/analytics'
            ? pathname === '/admin/analytics'
            : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${
              active
                ? 'bg-white/15 text-white border border-white/20'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}

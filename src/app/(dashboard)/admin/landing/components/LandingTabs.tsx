'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Servicios (Booksy)', href: '/admin/landing' },
  { label: 'Resultados', href: '/admin/landing/results' },
  { label: 'Testimonios Salón', href: '/admin/landing/testimonials/salon' },
  { label: 'Testimonios Academia', href: '/admin/landing/testimonials/academia' },
  { label: 'FAQ', href: '/admin/landing/faq' },
  { label: 'Horarios', href: '/admin/landing/schedule' },
]

export function LandingTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
      {TABS.map((tab) => {
        const active =
          tab.href === '/admin/landing'
            ? pathname === '/admin/landing'
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

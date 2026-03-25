'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Usuarios', href: '/admin/users' },
  { label: 'Comunidad', href: '/admin/users/community' },
]

export function UserCommunityTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
      {TABS.map((tab) => {
        const active =
          tab.href === '/admin/users'
            ? pathname === '/admin/users'
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

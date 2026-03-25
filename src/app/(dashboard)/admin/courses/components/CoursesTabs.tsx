'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Cursos', href: '/admin/courses' },
  { label: 'Certificados', href: '/admin/courses/certificates' },
  { label: 'Revision de examenes', href: '/admin/courses/review' },
]

function isCoursesRootActive(pathname: string) {
  if (pathname === '/admin/courses') return true
  if (!pathname.startsWith('/admin/courses/')) return false
  return !pathname.startsWith('/admin/courses/certificates') && !pathname.startsWith('/admin/courses/review')
}

export function CoursesTabs() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
      {TABS.map((tab) => {
        const active =
          tab.href === '/admin/courses'
            ? isCoursesRootActive(pathname)
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

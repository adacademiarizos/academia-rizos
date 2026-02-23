/**
 * Admin page protection utility
 * Use this to protect server-side admin pages
 */

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'

/**
 * Protect an admin page by checking session and role
 * Redirects to signin if not authenticated
 * Redirects to /student if not ADMIN role
 */
export async function protectAdminPage() {
  const session = await getServerSession()

  if (!session?.user?.email) {
    redirect('/signin')
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })

  if (!user || user.role !== 'ADMIN') {
    redirect('/student')
  }
}

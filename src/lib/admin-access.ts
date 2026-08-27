import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'

export async function getAdminUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, role: true },
  })

  return user?.role === 'ADMIN' ? user : null
}

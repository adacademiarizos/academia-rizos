import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'
import { NotificationsList } from '@/app/components/NotificationsList'

export const metadata = {
  title: 'Notificaciones | Apoteósicas',
  description: 'Todas tus notificaciones en un solo lugar',
}

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    redirect('/signin')
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })

  if (!user) {
    redirect('/signin')
  }

  return <NotificationsList />
}

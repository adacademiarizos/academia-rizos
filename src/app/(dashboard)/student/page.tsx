import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { StudentDashboard } from '@/app/components/StudentDashboard'

export const metadata = {
  title: 'Mi Dashboard | Apoteósicas',
  description: 'Tu panel de control de aprendizaje',
}

export default async function StudentDashboardPage() {
  // Check authentication
  const session = await getServerSession()
  if (!session?.user?.email) {
    redirect('/signin')
  }

  // Verify user exists and get role
  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })

  if (!user) {
    redirect('/signin')
  }

  // Redirect ADMIN users to admin dashboard
  if (user.role === 'ADMIN') {
    redirect('/admin')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mi Dashboard</h1>
        <p className="text-white/50 mt-1 text-sm">
          Controla tu progreso de aprendizaje y logros personales
        </p>
      </div>
      <StudentDashboard />
    </div>
  )
}

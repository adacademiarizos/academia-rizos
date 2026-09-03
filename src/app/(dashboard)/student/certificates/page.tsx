import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'
import { StudentCertificates } from '@/app/components/StudentCertificates'

export const metadata = {
  title: 'Mis certificados | Apoteósicas',
  description: 'Descarga y comparte los certificados de los cursos que completaste',
}

export default async function StudentCertificatesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    redirect('/signin?callbackUrl=/student/certificates')
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })

  if (!user) {
    redirect('/signin')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mis certificados</h1>
        <p className="mt-1 text-sm text-white/50">
          Descarga el PDF o comparte el enlace de verificación con quien lo necesite.
        </p>
      </div>
      <StudentCertificates />
    </div>
  )
}

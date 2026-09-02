import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'
import OnboardingForm from './onboarding-form'

export const metadata = {
  title: 'Completa tu perfil | Apoteósicas',
  description: 'Confirma el nombre que aparecerá en tus certificados',
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.invalidated) {
    redirect('/signin?callbackUrl=/onboarding')
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { name: true, email: true, image: true, phone: true, deletedAt: true },
  })

  if (!user || user.deletedAt) {
    redirect('/signin')
  }

  const { next } = await searchParams
  // Only same-origin paths are honoured, so a crafted `next` cannot bounce a
  // freshly signed-in student to another site.
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/student'

  return (
    <OnboardingForm
      initialName={user.name ?? ''}
      email={user.email}
      initialImage={user.image}
      initialPhone={user.phone ?? ''}
      next={safeNext}
    />
  )
}

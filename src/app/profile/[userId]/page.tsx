import { PublicUserProfile } from '@/app/components/PublicUserProfile'

export const metadata = {
  title: 'Perfil de usuario | Apoteósicas',
  description: 'Ver perfil, logros y actividad del usuario',
}

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  return params.then(({ userId }) => (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <PublicUserProfile userId={userId} />
      </div>
    </div>
  ))
}

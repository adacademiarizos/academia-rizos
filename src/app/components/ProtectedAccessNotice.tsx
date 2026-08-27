import Link from 'next/link'

export type ProtectedAccessReason =
  | 'SIGN_IN_REQUIRED'
  | 'ADMIN_ROLE_REQUIRED'
  | 'STAFF_ROLE_REQUIRED'
  | 'STUDENT_DASHBOARD_UNAVAILABLE'
  | 'COURSE_PURCHASE_REQUIRED'
  | 'COURSE_ACCESS_EXPIRED'
  | 'COURSE_ACCESS_REVOKED'

function getAccessCopy(reason: ProtectedAccessReason, from?: string) {
  switch (reason) {
    case 'SIGN_IN_REQUIRED':
      return {
        title: 'Necesitas iniciar sesion',
        description:
          from?.startsWith('/learn/')
            ? 'Debes iniciar sesion para entrar a la academia y validar si tienes acceso al contenido.'
            : 'Debes iniciar sesion para acceder a esta area protegida.',
      }
    case 'ADMIN_ROLE_REQUIRED':
      return {
        title: 'Area exclusiva para administradores',
        description:
          'Esta URL solo esta disponible para administradores de la plataforma. Tu cuenta no tiene ese nivel de acceso.',
      }
    case 'STAFF_ROLE_REQUIRED':
      return {
        title: 'Area exclusiva para staff autorizado',
        description:
          'Esta seccion esta reservada para personal interno y administradores. Tu cuenta no tiene permiso para entrar aqui.',
      }
    case 'STUDENT_DASHBOARD_UNAVAILABLE':
      return {
        title: 'Este dashboard no corresponde a tu rol',
        description:
          'Tu cuenta pertenece a un rol interno. Debes entrar por el panel que corresponde a tu rol, no por el dashboard del alumno.',
      }
    case 'COURSE_PURCHASE_REQUIRED':
      return {
        title: 'Curso no disponible para tu cuenta',
        description:
          'Necesitas haber comprado este curso para entrar al contenido, tests, chat y recursos privados.',
      }
    case 'COURSE_ACCESS_EXPIRED':
      return {
        title: 'Tu acceso al curso expiro',
        description:
          'La compra de este curso ya no tiene acceso activo. Si quieres continuar, necesitas renovar o volver a comprar el acceso.',
      }
    case 'COURSE_ACCESS_REVOKED':
      return {
        title: 'Tu acceso al curso fue revocado',
        description:
          'Este acceso ya no esta disponible porque el pago fue reembolsado, disputado o invalidado. Si necesitas ayuda, contacta al equipo o vuelve a comprar el curso.',
      }
  }
}

interface ProtectedAccessNoticeProps {
  reason: ProtectedAccessReason
  from?: string
  primaryHref?: string
  primaryLabel?: string
  showSignIn?: boolean
}

export function ProtectedAccessNotice({
  reason,
  from,
  primaryHref = '/',
  primaryLabel = 'Ir a la pagina principal',
  showSignIn = true,
}: ProtectedAccessNoticeProps) {
  const copy = getAccessCopy(reason, from)

  return (
    <main className="min-h-screen bg-gradient-to-br from-ap-ink via-ap-ink to-black px-6 py-16">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-ap-copper/15 text-3xl text-ap-copper">
          !
        </div>
        <h1 className="text-3xl font-bold text-ap-ivory">{copy.title}</h1>
        <p className="mt-4 text-base leading-relaxed text-zinc-300">{copy.description}</p>
        {from ? (
          <p className="mt-3 text-sm text-zinc-500">
            URL solicitada: <span className="font-mono text-zinc-400">{from}</span>
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={primaryHref}
            className="rounded-full bg-ap-copper px-6 py-3 font-semibold text-white transition hover:bg-orange-700"
          >
            {primaryLabel}
          </Link>
          {showSignIn ? (
            <Link
              href={from ? `/signin?callbackUrl=${encodeURIComponent(from)}` : '/signin'}
              className="rounded-full border border-white/15 px-6 py-3 font-semibold text-zinc-200 transition hover:border-ap-copper hover:text-ap-copper"
            >
              Iniciar sesion
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  )
}

import { ProtectedAccessNotice, type ProtectedAccessReason } from '@/app/components/ProtectedAccessNotice'

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: ProtectedAccessReason; from?: string }>
}) {
  const { reason, from } = await searchParams

  return (
    <ProtectedAccessNotice
      reason={reason ?? 'SIGN_IN_REQUIRED'}
      from={from}
      showSignIn={reason !== 'COURSE_PURCHASE_REQUIRED' && reason !== 'COURSE_ACCESS_EXPIRED'}
    />
  )
}

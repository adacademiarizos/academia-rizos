'use client'

import { useEffect, useState } from 'react'
import type { ProtectedAccessReason } from '@/app/components/ProtectedAccessNotice'

type CourseAccessResponse = {
  hasAccess: boolean
  isExpired: boolean
  accessUntil: string | null
  requiresLogin: boolean
  reason: ProtectedAccessReason | null
  viaAdmin: boolean
}

export function useCourseAccess(courseId: string) {
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [reason, setReason] = useState<ProtectedAccessReason | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function checkAccess() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/course-access/${courseId}`, {
          cache: 'no-store',
        })
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.error || 'No se pudo validar el acceso al curso.')
        }

        const data = payload.data as CourseAccessResponse

        if (cancelled) {
          return
        }

        setHasAccess(data.hasAccess)
        setReason(data.hasAccess ? null : data.reason)
      } catch (accessError) {
        if (cancelled) {
          return
        }

        setHasAccess(false)
        setReason(null)
        setError(
          accessError instanceof Error
            ? accessError.message
            : 'No se pudo validar el acceso al curso.'
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void checkAccess()

    return () => {
      cancelled = true
    }
  }, [courseId])

  return { loading, hasAccess, reason, error }
}

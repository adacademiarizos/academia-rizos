import { z } from 'zod'

export const CERTIFICATE_SLOGAN_MAX_LENGTH = 100

export const certificateSloganSchema = z
  .string()
  .trim()
  .max(
    CERTIFICATE_SLOGAN_MAX_LENGTH,
    `El slogan del certificado debe tener como máximo ${CERTIFICATE_SLOGAN_MAX_LENGTH} caracteres.`
  )

export function normalizeCertificateSlogan(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') return null

  const slogan = value.trim()
  return slogan.length > 0 ? slogan : null
}

export function getCoursePublicationError(
  isActive: boolean,
  certificateSlogan: string | null | undefined
): string | null {
  if (isActive && !normalizeCertificateSlogan(certificateSlogan)) {
    return 'Debes completar el slogan del certificado antes de publicar el curso.'
  }

  return null
}

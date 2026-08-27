import {
  certificateSloganSchema,
  getCoursePublicationError,
  normalizeCertificateSlogan,
} from '@/validators/course.schema'

describe('certificate slogan rules', () => {
  it('normalizes surrounding whitespace and keeps a valid slogan', () => {
    expect(normalizeCertificateSlogan('  Técnica y definición de rizos  ')).toBe(
      'Técnica y definición de rizos'
    )
  })

  it('turns blank values into null for draft courses', () => {
    expect(normalizeCertificateSlogan('   ')).toBeNull()
    expect(getCoursePublicationError(false, '   ')).toBeNull()
  })

  it('rejects publication without a slogan', () => {
    expect(getCoursePublicationError(true, null)).toBe(
      'Debes completar el slogan del certificado antes de publicar el curso.'
    )
  })

  it('enforces the 100 character limit after trimming', () => {
    expect(certificateSloganSchema.safeParse(` ${'a'.repeat(100)} `).success).toBe(true)
    expect(certificateSloganSchema.safeParse('a'.repeat(101)).success).toBe(false)
  })
})

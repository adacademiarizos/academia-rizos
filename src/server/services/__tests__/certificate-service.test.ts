/**
 * Characterization tests for certificate.service.ts (Phase 0 — WS0).
 * Pins current behavior before WS-D08 (partial unique index) and WS-D
 * (certificateSlogan removal) touch this file. Zero production change.
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { db } from '@/lib/db'
import { generateCertificatePdf } from '@/lib/pdf'
import { uploadFile } from '@/lib/storage'
import { sendCertificateEmail } from '@/lib/mail'
import { NotificationService } from '@/server/services/notification-service'
import { generateAndSaveCertificate } from '@/server/services/certificate.service'

vi.mock('@/lib/db', () => ({
  db: {
    certificate: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
    },
    userActivity: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/pdf', () => ({
  generateCertificatePdf: vi.fn(),
}))

vi.mock('@/lib/storage', () => ({
  uploadFile: vi.fn(),
}))

vi.mock('@/lib/mail', () => ({
  sendCertificateEmail: vi.fn(),
}))

vi.mock('@/server/services/notification-service', () => ({
  NotificationService: {
    triggerOnCertificateIssued: vi.fn(),
    triggerOnCourseCompletion: vi.fn(),
  },
}))

describe('certificate-service (characterization)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(db.certificate.findFirst as Mock).mockResolvedValue(null)
    ;(db.user.findUnique as Mock).mockResolvedValue({ name: 'Ana Rizos', email: 'ana@example.com' })
    ;(db.course.findUnique as Mock).mockResolvedValue({
      title: 'Curso de rizos',
    })
    ;(generateCertificatePdf as Mock).mockResolvedValue(Buffer.from('pdf'))
    ;(uploadFile as Mock).mockResolvedValue('https://files.example/certificate.pdf')
    ;(db.certificate.create as Mock).mockResolvedValue({ id: 'certificate-1', code: 'CERT-1', valid: true })
    ;(db.userActivity.create as Mock).mockResolvedValue({})
    ;(NotificationService.triggerOnCertificateIssued as Mock).mockResolvedValue(undefined)
    ;(NotificationService.triggerOnCourseCompletion as Mock).mockResolvedValue(undefined)
    ;(sendCertificateEmail as Mock).mockResolvedValue(undefined)
  })

  it('short-circuits on an existing valid certificate without regenerating the PDF', async () => {
    const existing = { id: 'certificate-existing', code: 'CERT-EXISTING', valid: true }
    ;(db.certificate.findFirst as Mock).mockResolvedValue(existing)

    const result = await generateAndSaveCertificate('user-1', 'course-1')

    expect(result).toBe(existing)
    expect(generateCertificatePdf).not.toHaveBeenCalled()
    expect(uploadFile).not.toHaveBeenCalled()
    expect(db.certificate.create).not.toHaveBeenCalled()
  })

  it('still resolves with the certificate when sendCertificateEmail rejects', async () => {
    ;(sendCertificateEmail as Mock).mockRejectedValue(new Error('smtp down'))

    const result = await generateAndSaveCertificate('user-1', 'course-1')

    expect(result).toMatchObject({ id: 'certificate-1', code: 'CERT-1' })
    expect(sendCertificateEmail).toHaveBeenCalledTimes(1)
  })
})

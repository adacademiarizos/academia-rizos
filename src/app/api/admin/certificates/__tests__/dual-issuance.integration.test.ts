/**
 * Integration tests for certificate dual-issuance (design §D-08/WS-D08, owner-approved 2026-09-01).
 *
 * Exercises `generateAndSaveCertificate` against a real Postgres instance to
 * prove the WS-D08 partial unique index (`Certificate_userId_courseId_valid_key`,
 * `CREATE UNIQUE INDEX ... WHERE "valid" = true`) plus its `P2002` catch
 * collapse two concurrent issuance attempts into exactly one valid `Certificate`.
 *
 * PDF generation, R2 upload, and email/notification side effects are mocked —
 * this test targets the DB constraint and the service's race handling, not
 * external infrastructure.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/pdf', () => ({
  generateCertificatePdf: vi.fn().mockResolvedValue(Buffer.from('pdf')),
}))
vi.mock('@/lib/storage', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://example.com/cert.pdf'),
}))
vi.mock('@/lib/mail', () => ({
  sendCertificateEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/server/services/notification-service', () => ({
  NotificationService: {
    triggerOnCertificateIssued: vi.fn().mockResolvedValue(undefined),
    triggerOnCourseCompletion: vi.fn().mockResolvedValue(undefined),
  },
}))

import { db } from '@/lib/db'
import { generateAndSaveCertificate } from '@/server/services/certificate.service'

describe('certificate dual-issuance (Phase 2 — WS-D08)', () => {
  afterAll(async () => {
    await db.$disconnect()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves two concurrent generateAndSaveCertificate calls for the same (userId, courseId) to exactly one Certificate', async () => {
    const student = await db.user.create({
      data: { email: `student-${crypto.randomUUID()}@example.com`, role: 'STUDENT' },
      select: { id: true },
    })
    const course = await db.course.create({
      data: {
        title: `Dual issuance ${crypto.randomUUID()}`,
        priceCents: 0,
      },
      select: { id: true },
    })

    try {
      const [certA, certB] = await Promise.all([
        generateAndSaveCertificate(student.id, course.id),
        generateAndSaveCertificate(student.id, course.id),
      ])

      expect(certA.id).toBeDefined()
      expect(certB.id).toBeDefined()

      const validCertificates = await db.certificate.findMany({
        where: { userId: student.id, courseId: course.id, valid: true },
      })
      expect(validCertificates).toHaveLength(1)

      // Both concurrent callers must resolve to the SAME winning row, not two
      // different objects that happen to share a userId/courseId.
      expect(certA.id).toBe(certB.id)
      expect(certA.id).toBe(validCertificates[0].id)
    } finally {
      await db.certificate.deleteMany({ where: { courseId: course.id } })
      await db.course.delete({ where: { id: course.id } })
      await db.user.delete({ where: { id: student.id } })
    }
  })

  async function seedFixture() {
    const student = await db.user.create({
      data: { email: `student-${crypto.randomUUID()}@example.com`, role: 'STUDENT' },
      select: { id: true },
    })
    const course = await db.course.create({
      data: {
        title: `Dual issuance order ${crypto.randomUUID()}`,
        priceCents: 0,
      },
      select: { id: true },
    })
    return { student, course }
  }

  it('Order A — automatic issuance followed by legacy manual approval resolves to exactly one Certificate', async () => {
    const { student, course } = await seedFixture()

    try {
      // A legacy pending-approval placeholder already exists (valid=false, no pdfUrl).
      const placeholder = await db.certificate.create({
        data: {
          code: `PENDING-${crypto.randomUUID()}`,
          userId: student.id,
          courseId: course.id,
          valid: false,
          pdfUrl: null,
          issuedAt: new Date(),
        },
      })

      // Fires first: the automatic path (e.g. reviewFinalExamAttempt) issues a
      // real certificate — the placeholder's valid=false never satisfies the
      // idempotency check.
      const automatic = await generateAndSaveCertificate(student.id, course.id)
      expect(automatic.valid).toBe(true)

      // Fires second: the legacy manual approval path re-runs the same
      // issuance call (idempotent hit), then deletes its own placeholder.
      const manual = await generateAndSaveCertificate(student.id, course.id)
      await db.certificate.delete({ where: { id: placeholder.id } })

      expect(manual.id).toBe(automatic.id)

      const all = await db.certificate.findMany({ where: { userId: student.id, courseId: course.id } })
      expect(all).toHaveLength(1)
      expect(all[0].valid).toBe(true)
      expect(all[0].id).toBe(automatic.id)
    } finally {
      await db.certificate.deleteMany({ where: { courseId: course.id } })
      await db.course.delete({ where: { id: course.id } })
      await db.user.delete({ where: { id: student.id } })
    }
  })

  it('Order B — legacy manual approval followed by automatic issuance resolves to exactly one Certificate', async () => {
    const { student, course } = await seedFixture()

    try {
      const placeholder = await db.certificate.create({
        data: {
          code: `PENDING-${crypto.randomUUID()}`,
          userId: student.id,
          courseId: course.id,
          valid: false,
          pdfUrl: null,
          issuedAt: new Date(),
        },
      })

      // Fires first: the legacy manual approval path issues the certificate
      // and deletes its own placeholder.
      const manual = await generateAndSaveCertificate(student.id, course.id)
      await db.certificate.delete({ where: { id: placeholder.id } })
      expect(manual.valid).toBe(true)

      // Fires second: the automatic path (e.g. the cron re-checking or
      // reviewFinalExamAttempt) hits the same idempotency check.
      const automatic = await generateAndSaveCertificate(student.id, course.id)
      expect(automatic.id).toBe(manual.id)

      const all = await db.certificate.findMany({ where: { userId: student.id, courseId: course.id } })
      expect(all).toHaveLength(1)
      expect(all[0].valid).toBe(true)
      expect(all[0].id).toBe(manual.id)
    } finally {
      await db.certificate.deleteMany({ where: { courseId: course.id } })
      await db.course.delete({ where: { id: course.id } })
      await db.user.delete({ where: { id: student.id } })
    }
  })
})

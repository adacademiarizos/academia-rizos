jest.mock('@/lib/db', () => ({
  db: {
    certificate: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    course: {
      findUnique: jest.fn(),
    },
    userActivity: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/pdf', () => ({
  generateCertificatePdf: jest.fn(),
}))

jest.mock('@/lib/storage', () => ({
  uploadFile: jest.fn(),
}))

jest.mock('@/lib/mail', () => ({
  sendCertificateEmail: jest.fn(),
}))

import { db } from '@/lib/db'
import { generateCertificatePdf } from '@/lib/pdf'
import { uploadFile } from '@/lib/storage'
import { sendCertificateEmail } from '@/lib/mail'
import { generateAndSaveCertificate } from '@/server/services/certificate.service'

const mockedDb = db as unknown as {
  certificate: { findFirst: jest.Mock; create: jest.Mock }
  user: { findUnique: jest.Mock }
  course: { findUnique: jest.Mock }
  userActivity: { create: jest.Mock }
}

describe('certificate issuance', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedDb.certificate.findFirst.mockResolvedValue(null)
    mockedDb.user.findUnique.mockResolvedValue({ name: 'Ana Rizos', email: 'ana@example.com' })
    mockedDb.userActivity.create.mockResolvedValue({})
    ;(sendCertificateEmail as jest.Mock).mockResolvedValue(undefined)
  })

  it('refuses to issue a certificate when the course has no slogan', async () => {
    mockedDb.course.findUnique.mockResolvedValue({ title: 'Curso de rizos', certificateSlogan: null })

    await expect(generateAndSaveCertificate('user-1', 'course-1')).rejects.toThrow(
      'Cannot issue a certificate for a course without a certificate slogan'
    )
    expect(generateCertificatePdf).not.toHaveBeenCalled()
  })

  it('passes the normalized course slogan into the PDF generator', async () => {
    mockedDb.course.findUnique.mockResolvedValue({
      title: 'Curso de rizos',
      certificateSlogan: '  Especialización en definición  ',
    })
    ;(generateCertificatePdf as jest.Mock).mockResolvedValue(Buffer.from('pdf'))
    ;(uploadFile as jest.Mock).mockResolvedValue('https://files.example/certificate.pdf')
    mockedDb.certificate.create.mockResolvedValue({ id: 'certificate-1', code: 'CERT-1' })

    await generateAndSaveCertificate('user-1', 'course-1')

    expect(generateCertificatePdf).toHaveBeenCalledWith(
      expect.objectContaining({
        userName: 'Ana Rizos',
        courseName: 'Curso de rizos',
        certificateSlogan: 'Especialización en definición',
      })
    )
  })
})

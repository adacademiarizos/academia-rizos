const mockToDataURL = jest
  .fn()
  .mockResolvedValue('data:image/png;base64,qr-code')

jest.mock('qrcode', () => ({
  __esModule: true,
  default: {
    toDataURL: mockToDataURL,
  },
}))

import { buildCertificateHtml } from '@/lib/pdf'

describe('certificate PDF template', () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  afterEach(() => {
    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
    }
  })

  it('uses the approved layout with escaped dynamic certificate data', async () => {
    const html = await buildCertificateHtml({
      userName: 'Ana <Rizos> & Co.',
      courseName: 'Definición & cuidado',
      code: 'CERT-TEST-001',
      issuedAt: new Date('2026-08-05T12:00:00.000Z'),
    })

    expect(html).toContain('APOTEÓSICAS')
    expect(html).toContain('CERTIFICADO')
    expect(html).toContain('Ana &lt;Rizos&gt; &amp; Co.')
    expect(html).toContain('Definición &amp; cuidado')
    expect(html).toContain('CERT-TEST-001')
    expect(html).not.toContain('class="specialization"')
    expect(mockToDataURL).toHaveBeenCalledWith(
      'http://localhost:3000/verify/certificate/CERT-TEST-001',
      expect.objectContaining({
        errorCorrectionLevel: 'H',
        margin: 0,
        width: 120,
      })
    )
    expect(html).toContain('data:image/png;base64,qr-code')
    expect(html).toContain('data:image/png;base64,')
    expect(html).not.toContain('contenteditable')
    expect(html).not.toContain('Imprimir / Guardar PDF')
  })
})

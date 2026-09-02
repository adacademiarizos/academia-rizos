import { describe, expect, it } from 'vitest'

import { buildCertificateHtml } from '@/lib/pdf'

/**
 * The certificate shipped for a while with only the `latin-ext` slice of its
 * display faces. Those files carry the extended characters and nothing else, so
 * every A-Z silently fell back to Georgia and the signature to Comic Sans: the
 * diploma still rendered, still validated, and looked nothing like the design.
 *
 * Nothing about that failure is visible without opening a PDF, so these tests
 * assert the two things that were actually missing.
 */
describe('certificate typography', () => {
  const BASIC_LATIN_RANGE = 'U+0000-00FF'

  it('embeds a face covering basic Latin for every family it styles text with', async () => {
    const html = await buildCertificateHtml({
      userName: 'Enmanuel Cruz Perez',
      courseName: 'Curso de prueba',
      code: 'ABCD-1234',
      issuedAt: new Date('2026-09-02'),
    })

    for (const family of ['Cormorant Garamond', 'Great Vibes']) {
      const faces = [...html.matchAll(new RegExp(`@font-face \{[^}]*'${family}'[^}]*\}`, 'g'))].map(
        (match) => match[0]
      )

      expect(faces.length, `${family} has no @font-face`).toBeGreaterThan(0)
      expect(
        faces.some((face) => face.includes(BASIC_LATIN_RANGE)),
        `${family} only ships ranges outside basic Latin, so A-Z will fall back`
      ).toBe(true)
    }
  })

  it('embeds each font as a real woff2 payload rather than an empty data URI', async () => {
    const html = await buildCertificateHtml({
      userName: 'Enmanuel Cruz Perez',
      courseName: 'Curso de prueba',
      code: 'ABCD-1234',
      issuedAt: new Date('2026-09-02'),
    })

    const payloads = [...html.matchAll(/url\('data:font\/woff2;base64,([^']*)'\)/g)].map(
      (match) => match[1]
    )

    expect(payloads.length).toBeGreaterThanOrEqual(4)
    for (const payload of payloads) {
      // "wOF2" is the woff2 magic number; base64 of those bytes starts d09GMg.
      expect(payload.startsWith('d09GMg')).toBe(true)
    }
  })
})

/**
 * Regenerate all valid certificates with the updated PDF design.
 * Run: node scripts/regenerate-certificates.mjs
 */

import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, '..', '.env') })

// ── Dynamic imports (after env is loaded) ───────────────────────────
const { PrismaClient } = await import('@prisma/client')
const { generateCertificatePdf } = await import('../src/lib/pdf.ts')
const { uploadFile } = await import('../src/lib/storage.ts')

const db = new PrismaClient()

async function main() {
  const certs = await db.certificate.findMany({
    where: { valid: true, pdfUrl: { not: null } },
    include: {
      user:   { select: { name: true, email: true } },
      course: { select: { title: true } },
    },
  })

  console.log(`Found ${certs.length} valid certificate(s) to regenerate.\n`)

  let ok = 0
  let fail = 0

  for (const cert of certs) {
    const userName   = cert.user.name  ?? cert.user.email ?? 'Estudiante'
    const courseName = cert.course.title
    const label      = `[${cert.code}] ${userName} — ${courseName}`

    try {
      process.stdout.write(`  Regenerating ${label} ... `)

      const pdfBuffer = await generateCertificatePdf({
        userName,
        courseName,
        code:     cert.code,
        issuedAt: cert.issuedAt,
      })

      // Overwrite the same R2 key so the existing URL stays valid
      const key    = `certificates/${cert.code}.pdf`
      const newUrl = await uploadFile(key, pdfBuffer, 'application/pdf')

      // Update pdfUrl in DB (in case the public base URL changed)
      await db.certificate.update({
        where: { id: cert.id },
        data:  { pdfUrl: newUrl },
      })

      console.log('✓')
      ok++
    } catch (err) {
      console.log(`✗  ${err.message}`)
      fail++
    }
  }

  console.log(`\nDone. ${ok} regenerated, ${fail} failed.`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => db.$disconnect())

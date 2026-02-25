/**
 * Regenerate all valid certificates with the updated PDF design.
 * Run: npx tsx scripts/regenerate-certificates.ts
 */

import * as dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.join(process.cwd(), '.env') })

import { PrismaClient } from '@prisma/client'
import { generateCertificatePdf } from '../src/lib/pdf'
import { uploadFile } from '../src/lib/storage'

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
    const userName   = cert.user.name ?? cert.user.email ?? 'Estudiante'
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

      // Overwrite the same R2 key so existing download URLs stay valid
      const key    = `certificates/${cert.code}.pdf`
      const newUrl = await uploadFile(key, pdfBuffer, 'application/pdf')

      // Update pdfUrl in DB in case the public base URL differs
      await db.certificate.update({
        where: { id: cert.id },
        data:  { pdfUrl: newUrl },
      })

      console.log('✓')
      ok++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`✗  ${msg}`)
      fail++
    }
  }

  console.log(`\nDone. ${ok} regenerated, ${fail} failed.`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => db.$disconnect())

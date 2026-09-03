'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Award, Download, Link2, Check } from 'lucide-react'

type Certificate = {
  id: string
  code: string
  courseId: string
  courseTitle: string
  issuedAt: string
  pdfUrl: string | null
  verificationUrl: string
}

export function StudentCertificates() {
  const [certificates, setCertificates] = useState<Certificate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/certificates')
      .then((response) => {
        if (!response.ok) throw new Error('request failed')
        return response.json()
      })
      .then((result) => {
        if (!active) return
        if (result.success) setCertificates(result.data)
        else setError('No pudimos cargar tus certificados.')
      })
      .catch(() => {
        if (active) setError('No pudimos cargar tus certificados.')
      })
    return () => {
      active = false
    }
  }, [])

  const copyVerification = async (certificate: Certificate) => {
    const absolute = `${window.location.origin}${certificate.verificationUrl}`
    try {
      await navigator.clipboard.writeText(absolute)
      setCopiedCode(certificate.code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      // Clipboard is blocked in some embedded contexts; the link stays visible
      // next to the button so it can still be copied by hand.
      setError('Tu navegador bloqueó el portapapeles. Copia el enlace manualmente.')
    }
  }

  if (error && !certificates) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-sm text-red-200">
        {error}
      </div>
    )
  }

  if (!certificates) {
    return <div className="py-16 text-center text-white/40">Cargando certificados...</div>
  }

  if (certificates.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-white/5 p-10 text-center">
        <Award className="mx-auto h-10 w-10 text-white/25" />
        <h2 className="mt-4 text-base font-semibold text-white">Todavía no tienes certificados</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/50">
          Cuando completes todas las lecciones de un curso y apruebes su examen final, tu
          certificado aparecerá aquí listo para descargar.
        </p>
        <Link
          href="/courses"
          className="mt-6 inline-flex rounded-full bg-ap-copper px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Ver cursos
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {certificates.map((certificate) => (
        <article
          key={certificate.id}
          className="rounded-2xl border border-zinc-800 bg-white/5 p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-ap-copper/30 bg-ap-copper/15">
                <Award className="h-5 w-5 text-ap-copper" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-white">
                  {certificate.courseTitle}
                </h2>
                <p className="mt-1 text-sm text-white/50">
                  Emitido el{' '}
                  {new Date(certificate.issuedAt).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <p className="mt-2 font-mono text-xs tracking-wide text-white/35">
                  {certificate.code}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {certificate.pdfUrl && (
                <a
                  href={certificate.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-ap-copper px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  <Download className="h-4 w-4" />
                  Descargar PDF
                </a>
              )}
              <Link
                href={certificate.verificationUrl}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                Ver verificación
              </Link>
              <button
                type="button"
                onClick={() => copyVerification(certificate)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                {copiedCode === certificate.code ? (
                  <>
                    <Check className="h-4 w-4 text-green-400" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    Copiar enlace
                  </>
                )}
              </button>
            </div>
          </div>
        </article>
      ))}
      {error && <p className="text-sm text-amber-300">{error}</p>}
    </div>
  )
}

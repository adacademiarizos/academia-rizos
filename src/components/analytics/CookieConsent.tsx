'use client'

import { useState, useEffect } from 'react'

const CONSENT_KEY = 'ap_analytics_consent'

export function getAnalyticsConsent(): boolean | null {
  if (typeof window === 'undefined') return null
  const val = localStorage.getItem(CONSENT_KEY)
  if (val === 'true') return true
  if (val === 'false') return false
  return null
}

export function CookieConsent() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const consent = getAnalyticsConsent()
    if (consent === null) {
      setShow(true)
    }
  }, [])

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, 'true')
    setShow(false)
  }

  function handleReject() {
    localStorage.setItem(CONSENT_KEY, 'false')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-300">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl p-5 shadow-2xl">
        <p className="text-sm text-white/70 mb-4">
          Usamos cookies analíticas para entender cómo se usa nuestra plataforma y mejorar tu
          experiencia. No compartimos estos datos con terceros.
        </p>
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={handleReject}
            className="rounded-xl px-4 py-2 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 border border-white/10 transition"
          >
            Rechazar
          </button>
          <button
            onClick={handleAccept}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-ap-copper hover:bg-ap-copper/80 transition"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'

type PreferenceCategory = 'COURSE_UPDATES' | 'COMMUNITY' | 'ACHIEVEMENTS'

type Preference = {
  category: PreferenceCategory
  enabled: boolean
}

const labels: Record<PreferenceCategory, { title: string; description: string }> = {
  COURSE_UPDATES: {
    title: 'Actualizaciones de cursos',
    description: 'Publicaciones explícitas de cursos o contenido al que ya tienes acceso.',
  },
  COMMUNITY: {
    title: 'Comunidad',
    description: 'Menciones y respuestas directas; nunca likes ni mensajes masivos.',
  },
  ACHIEVEMENTS: {
    title: 'Logros',
    description: 'Reconocimientos no transaccionales de tu actividad.',
  },
}

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [savingCategory, setSavingCategory] = useState<PreferenceCategory | null>(null)

  useEffect(() => {
    let active = true

    void fetch('/api/notification-preferences')
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (active && Array.isArray(payload?.data)) {
          setPreferences(payload.data)
        }
      })
      .catch(() => {
        // The notification feed remains usable if optional preferences fail.
      })

    return () => {
      active = false
    }
  }, [])

  const updatePreference = async (preference: Preference) => {
    const nextEnabled = !preference.enabled
    setSavingCategory(preference.category)
    setPreferences((current) => current.map((item) =>
      item.category === preference.category ? { ...item, enabled: nextEnabled } : item
    ))

    try {
      const response = await fetch('/api/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: preference.category, enabled: nextEnabled }),
      })
      if (!response.ok) throw new Error('Unable to update preference')
    } catch {
      setPreferences((current) => current.map((item) =>
        item.category === preference.category ? { ...item, enabled: preference.enabled } : item
      ))
    } finally {
      setSavingCategory(null)
    }
  }

  if (preferences.length === 0) return null

  return (
    // Settings the reader touches once should not stand between them and the
    // notifications, so the panel opens on demand.
    <details className="group mt-10 rounded-2xl border border-white/10 bg-white/[0.035]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 text-sm font-semibold text-[#FAF4EA] [&::-webkit-details-marker]:hidden">
        <span id="notification-preferences-title">Preferencias opcionales</span>
        <span aria-hidden="true" className="text-white/40 transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="px-4 pb-4">
      <p className="mb-3 text-xs leading-relaxed text-white/45">
        Los avisos de pagos, citas, seguridad y revisiones académicas siempre se mantienen activos.
      </p>
      <div className="space-y-2">
        {preferences.map((preference) => {
          const label = labels[preference.category]
          const saving = savingCategory === preference.category

          return (
            <div key={preference.category} className="flex items-center justify-between gap-4 rounded-xl bg-black/10 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/80">{label.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/40">{label.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preference.enabled}
                aria-label={`${preference.enabled ? 'Desactivar' : 'Activar'} ${label.title}`}
                disabled={saving}
                onClick={() => void updatePreference(preference)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ap-copper focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F1C19] disabled:opacity-60 ${
                  preference.enabled ? 'bg-ap-copper' : 'bg-white/15'
                }`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  preference.enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          )
        })}
      </div>
      </div>
    </details>
  )
}

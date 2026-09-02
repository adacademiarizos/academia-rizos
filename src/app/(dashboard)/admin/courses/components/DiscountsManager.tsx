'use client'

import { useCallback, useEffect, useState } from 'react'

type DiscountCode = {
  id: string
  code: string
  description: string | null
  type: 'PERCENT' | 'FIXED'
  value: number
  maxRedemptions: number | null
  redemptions: number
  expiresAt: string | null
  isActive: boolean
  course: { id: string; title: string } | null
}

type CourseOption = { id: string; title: string }

const cardClass =
  'rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_16px_50px_rgba(0,0,0,0.12)] sm:p-8'
const fieldClass =
  'h-11 rounded-2xl bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/20 transition disabled:opacity-50'

function describe(code: DiscountCode) {
  const amount = code.type === 'PERCENT' ? `${code.value}%` : `€${(code.value / 100).toFixed(2)}`
  const scope = code.course ? code.course.title : 'Todos los cursos'
  return { amount, scope }
}

/** A code is spent, expired or switched off — all three read as "no longer usable". */
function isSpent(code: DiscountCode) {
  if (!code.isActive) return true
  if (code.expiresAt && new Date(code.expiresAt) <= new Date()) return true
  return code.maxRedemptions !== null && code.redemptions >= code.maxRedemptions
}

export function DiscountsManager() {
  const [codes, setCodes] = useState<DiscountCode[] | null>(null)
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'PERCENT' | 'FIXED'>('PERCENT')
  const [value, setValue] = useState('')
  const [courseId, setCourseId] = useState('')
  const [maxRedemptions, setMaxRedemptions] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const load = useCallback(async () => {
    try {
      const [codesResponse, coursesResponse] = await Promise.all([
        fetch('/api/admin/discounts'),
        fetch('/api/courses'),
      ])
      const codesBody = await codesResponse.json()
      if (!codesResponse.ok) throw new Error(codesBody.error ?? 'No se pudieron cargar los códigos.')
      setCodes(codesBody.data ?? [])

      if (coursesResponse.ok) {
        const coursesBody = await coursesResponse.json()
        setCourses((coursesBody.data ?? []).map((item: CourseOption) => ({ id: item.id, title: item.title })))
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los códigos.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    const numericValue = Number(value)
    if (!code.trim() || !Number.isFinite(numericValue) || numericValue <= 0) {
      setError('Escribe un código y un valor mayor a cero.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          description: description.trim() || undefined,
          type,
          // A percentage travels as whole points; a fixed amount is typed in
          // euros here but stored in cents like every other price.
          value: type === 'PERCENT' ? Math.round(numericValue) : Math.round(numericValue * 100),
          courseId: courseId || null,
          maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      })
      const body = await response.json()
      if (!response.ok || !body.success) throw new Error(body.error ?? 'No se pudo crear el código.')

      setMessage(`Código ${body.data.code} creado.`)
      setCode('')
      setDescription('')
      setValue('')
      setCourseId('')
      setMaxRedemptions('')
      setExpiresAt('')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear el código.')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (target: DiscountCode) => {
    await fetch(`/api/admin/discounts/${target.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !target.isActive }),
    })
    await load()
  }

  const remove = async (target: DiscountCode) => {
    const response = await fetch(`/api/admin/discounts/${target.id}`, { method: 'DELETE' })
    const body = await response.json().catch(() => ({}))
    if (body?.message) setMessage(body.message)
    await load()
  }

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <h1 className="text-2xl font-semibold text-white">Códigos de descuento</h1>
        <p className="mt-1 text-sm text-white/50">
          Un código puede aplicar a un curso o a todos. Cada alumna puede usar cada código una sola vez.
          Si el descuento cubre el precio completo, la alumna se inscribe sin pasar por el pago.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {message}
          </p>
        )}

        <form onSubmit={create} className="mt-5 grid gap-3 sm:grid-cols-2">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="CÓDIGO (ej. RIZOS20)"
            disabled={saving}
            className={fieldClass}
          />
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descripción interna (opcional)"
            disabled={saving}
            className={fieldClass}
          />

          <select
            value={type}
            onChange={(event) => setType(event.target.value as 'PERCENT' | 'FIXED')}
            disabled={saving}
            className={fieldClass}
          >
            <option value="PERCENT">Porcentaje (%)</option>
            <option value="FIXED">Monto fijo (€)</option>
          </select>
          <input
            type="number"
            min={0}
            step={type === 'PERCENT' ? 1 : 0.01}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={type === 'PERCENT' ? 'Porcentaje (1-100)' : 'Euros a descontar'}
            disabled={saving}
            className={fieldClass}
          />

          <select
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            disabled={saving}
            className={fieldClass}
          >
            <option value="">Todos los cursos</option>
            {courses.map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={maxRedemptions}
            onChange={(event) => setMaxRedemptions(event.target.value)}
            placeholder="Usos totales (vacío = sin límite)"
            disabled={saving}
            className={fieldClass}
          />

          <input
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            disabled={saving}
            className={fieldClass}
          />
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-2xl bg-ap-copper px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {saving ? 'Creando…' : 'Crear código'}
          </button>
        </form>
      </section>

      <section className={cardClass}>
        <h2 className="text-xl font-semibold text-white">Códigos existentes</h2>

        {!codes ? (
          <p className="mt-6 text-sm text-white/50">Cargando…</p>
        ) : codes.length === 0 ? (
          <p className="mt-6 text-sm text-white/45">Todavía no hay códigos.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {codes.map((item) => {
              const { amount, scope } = describe(item)
              const spent = isSpent(item)
              return (
                <li
                  key={item.id}
                  className={`rounded-2xl border p-4 transition ${
                    spent ? 'border-white/5 bg-white/[0.02] opacity-60' : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-base font-semibold text-white">{item.code}</p>
                      <p className="text-xs text-white/45">
                        {amount} · {scope}
                        {item.description ? ` · ${item.description}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-white/75">
                        {item.redemptions}
                        {item.maxRedemptions === null ? ' usos' : `/${item.maxRedemptions} usos`}
                      </span>
                      {item.expiresAt && (
                        <span className="rounded-full bg-white/10 px-3 py-1 text-white/60">
                          vence {new Date(item.expiresAt).toLocaleDateString('es-ES')}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-3 py-1 font-semibold ${
                          item.isActive
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-white/10 text-white/50'
                        }`}
                      >
                        {item.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-4">
                    <button
                      type="button"
                      onClick={() => { void toggle(item) }}
                      className="text-xs font-medium text-white/60 transition hover:text-white"
                    >
                      {item.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { void remove(item) }}
                      className="text-xs font-medium text-red-300/80 transition hover:text-red-300"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

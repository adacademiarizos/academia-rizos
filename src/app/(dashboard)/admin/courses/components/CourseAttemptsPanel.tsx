'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

type AttemptSystem = 'ASSESSMENT' | 'LESSON_TEST' | 'FINAL_EXAM'

type AttemptTarget = {
  system: AttemptSystem
  targetId: string
  title: string
  scopeLabel: string
  baseMaxAttempts: number
}

type BlockedAttemptRow = {
  system: AttemptSystem
  targetId: string
  targetTitle: string
  scopeLabel: string
  student: { id: string; name: string | null; email: string | null }
  attemptsUsed: number
  attemptsAllowed: number
  lastAttemptAt: string | null
  lastStatus: string | null
  grantEndpoint: string
}

const cardClass = 'rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_16px_50px_rgba(0,0,0,0.12)] sm:p-8'

/**
 * Design §D-02/D-02b (AMENDED 2026-09-01): the admin selects ONE test/exam at
 * a time. This panel MUST NOT render any student list before a selection is
 * made — it opens on an explicit "elige un test" empty state.
 */
export function CourseAttemptsPanel({ courseId }: { courseId: string }) {
  const [targets, setTargets] = useState<AttemptTarget[] | null>(null)
  const [targetsError, setTargetsError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [rows, setRows] = useState<BlockedAttemptRow[] | null>(null)
  const [rowsError, setRowsError] = useState<string | null>(null)
  const [loadingRows, setLoadingRows] = useState(false)
  const [grantingKey, setGrantingKey] = useState<string | null>(null)

  const loadTargets = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/courses/${courseId}/attempts/targets`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'No se pudieron cargar los tests del curso.')
      setTargets(body.data ?? [])
    } catch (caught) {
      setTargetsError(caught instanceof Error ? caught.message : 'No se pudieron cargar los tests del curso.')
    }
  }, [courseId])

  useEffect(() => { void loadTargets() }, [loadTargets])

  const selectedTarget = useMemo(
    () => targets?.find((target) => `${target.system}:${target.targetId}` === selectedKey) ?? null,
    [targets, selectedKey]
  )

  const loadBlockedStudents = useCallback(async (target: AttemptTarget) => {
    setLoadingRows(true)
    setRowsError(null)
    try {
      const params = new URLSearchParams({ system: target.system, targetId: target.targetId })
      const response = await fetch(`/api/admin/courses/${courseId}/attempts?${params.toString()}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'No se pudieron cargar las alumnas bloqueadas.')
      setRows(body.data ?? [])
    } catch (caught) {
      setRowsError(caught instanceof Error ? caught.message : 'No se pudieron cargar las alumnas bloqueadas.')
    } finally {
      setLoadingRows(false)
    }
  }, [courseId])

  useEffect(() => {
    if (selectedTarget) void loadBlockedStudents(selectedTarget)
  }, [selectedTarget, loadBlockedStudents])

  const grantedByScope = useMemo(() => {
    const groups = new Map<string, AttemptTarget[]>()
    for (const target of targets ?? []) {
      const list = groups.get(target.scopeLabel) ?? []
      list.push(target)
      groups.set(target.scopeLabel, list)
    }
    return groups
  }, [targets])

  async function handleGrant(row: BlockedAttemptRow) {
    const key = `${row.system}:${row.targetId}:${row.student.id}`
    setGrantingKey(key)
    try {
      const response = await fetch(row.grantEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: row.student.id, attemptsGranted: 1 }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'No se pudo habilitar el intento.')
      toast.success('Intento habilitado.')
      if (selectedTarget) void loadBlockedStudents(selectedTarget)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'No se pudo habilitar el intento.')
    } finally {
      setGrantingKey(null)
    }
  }

  if (targetsError) {
    return <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{targetsError}</p>
  }
  if (!targets) return <p className="text-sm text-white/50">Cargando tests…</p>

  return (
    <section className={cardClass}>
      <h2 className="text-xl font-semibold text-white">Intentos</h2>
      <p className="mt-1 text-sm text-white/50">
        Elige un test o examen para ver qué alumnas agotaron sus intentos y habilitarles uno más.
      </p>

      <div className="mt-6">
        <label htmlFor="attempts-target-select" className="text-sm font-medium text-white/75">
          Test o examen
        </label>
        <select
          id="attempts-target-select"
          value={selectedKey ?? ''}
          onChange={(event) => setSelectedKey(event.target.value || null)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white"
        >
          <option value="">Elige un test…</option>
          {[...grantedByScope.entries()].map(([scopeLabel, group]) => (
            <optgroup key={scopeLabel} label={scopeLabel}>
              {group.map((target) => (
                <option key={`${target.system}:${target.targetId}`} value={`${target.system}:${target.targetId}`}>
                  {target.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {!selectedTarget ? (
        <p className="mt-6 text-sm text-white/45">Elige un test para ver sus alumnas bloqueadas.</p>
      ) : rowsError ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{rowsError}</p>
      ) : loadingRows || !rows ? (
        <p className="mt-6 text-sm text-white/50">Cargando alumnas bloqueadas…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-white/45">Nadie está bloqueada en este test.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((row) => {
            const key = `${row.system}:${row.targetId}:${row.student.id}`
            return (
              <li key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-white">{row.student.name ?? row.student.email}</p>
                    <p className="text-xs text-white/45">{row.student.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-white/75">
                      {row.attemptsUsed}/{row.attemptsAllowed} intentos
                    </span>
                    <button
                      type="button"
                      onClick={() => handleGrant(row)}
                      disabled={grantingKey === key}
                      className="rounded-full bg-ap-copper px-3 py-1 font-semibold text-white transition disabled:opacity-50"
                    >
                      {grantingKey === key ? 'Habilitando…' : 'Habilitar 1 intento'}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

'use client'

import type { ReactNode } from 'react'
import {
  estimateUploadProgress,
  formatFileSize,
  formatRemainingTime,
  getUploadStatusLabel,
  type UploadFeedbackStatus,
} from '@/lib/upload-feedback'

export interface UploadFeedbackCardProps {
  file: File
  status: UploadFeedbackStatus
  loaded?: number
  total?: number
  startedAt?: number
  error?: string | null
  metadata?: ReactNode
  onStart?: () => void
  onCancel?: () => void
  onRetry?: () => void
  onRemove?: () => void
  completedActionLabel?: string
  completedActionTone?: 'default' | 'danger'
}

export function UploadFeedbackCard({
  file,
  status,
  loaded = 0,
  total = file.size,
  startedAt,
  error,
  metadata,
  onStart,
  onCancel,
  onRetry,
  onRemove,
  completedActionLabel = 'Quitar archivo',
  completedActionTone = 'danger',
}: UploadFeedbackCardProps) {
  const progress = estimateUploadProgress({ loaded, total, startedAt: startedAt ?? Date.now() })
  const hasProgress = status === 'uploading' && progress.percentage !== null
  const isActive = status === 'analyzing' || status === 'preparing' || status === 'uploading' || status === 'saving'
  const isComplete = status === 'complete'

  return <article className={`overflow-hidden rounded-2xl border bg-white/[0.035] ${isActive ? 'border-dashed border-white/25' : 'border-white/10'}`} aria-live="polite">
    {isActive ? <div className="px-5 py-7 text-center">
      <p className="text-sm font-semibold text-white/65">{getUploadStatusLabel(status)}</p>
      <p className="mt-2 text-xs text-white/40">{file.type || 'Archivo'} · {formatFileSize(file.size)}</p>
      {hasProgress ? <>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/65">
          <span>Subiendo {progress.percentage}%</span>
          <span>{formatFileSize(loaded)} de {formatFileSize(total)}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10 text-left" role="progressbar" aria-label="Progreso de carga" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage ?? undefined}>
          <div className="h-full rounded-full bg-ap-copper transition-[width] duration-200" style={{ width: `${progress.percentage}%` }} />
        </div>
        <p className="mt-2 text-xs text-white/45">Tiempo aprox. restante: {formatRemainingTime(progress.secondsRemaining)}</p>
      </> : null}
      {error ? <p className="mt-3 text-sm text-red-200" role="alert">{error}</p> : null}
      {onCancel ? <button type="button" onClick={onCancel} className="mt-4 text-sm font-semibold text-red-300 hover:text-red-200">Cancelar carga</button> : null}
    </div> : <>
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{file.name}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
          <span>{formatFileSize(file.size)}</span>
          <span>{file.type || 'Archivo'}</span>
          {metadata}
        </div>
      </div>
      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${isComplete ? 'bg-emerald-400/10 text-emerald-300' : status === 'error' ? 'bg-red-400/10 text-red-300' : status === 'cancelled' ? 'bg-white/10 text-white/60' : 'bg-ap-copper/10 text-ap-copper'}`}>
        {getUploadStatusLabel(status)}
      </span>
    </div>

    {hasProgress ? <div className="border-t border-white/10 px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-xs text-white/65">
        <span>Subiendo {progress.percentage}%</span>
        <span>{formatFileSize(loaded)} de {formatFileSize(total)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Progreso de carga" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage ?? undefined}>
        <div className="h-full rounded-full bg-ap-copper transition-[width] duration-200" style={{ width: `${progress.percentage}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45">
        <span>{formatFileSize(progress.bytesPerSecond)}/s</span>
        <span>Tiempo restante: {formatRemainingTime(progress.secondsRemaining)}</span>
      </div>
    </div> : null}

    {isActive && !hasProgress ? <p className="border-t border-white/10 px-4 py-3 text-xs text-white/55" role="status">{getUploadStatusLabel(status)}</p> : null}
    {error ? <p className="border-t border-red-300/15 bg-red-400/5 px-4 py-3 text-sm text-red-200" role="alert">{error}</p> : null}

    <div className="flex flex-wrap gap-3 border-t border-white/10 px-4 py-3 text-sm">
      {status === 'ready' && onStart ? <span className="text-white/45" role="status">Preparando carga…</span> : null}
      {(status === 'error' || status === 'cancelled') && onRetry ? <button type="button" onClick={onRetry} className="font-semibold text-ap-copper hover:text-ap-ivory">Reintentar</button> : null}
      {isActive && onCancel ? <button type="button" onClick={onCancel} className="font-semibold text-red-300 hover:text-red-200">Cancelar carga</button> : null}
      {!isActive && !isComplete && onRemove ? <button type="button" onClick={onRemove} className="text-white/60 hover:text-white">Elegir otro archivo</button> : null}
      {isComplete && onRemove ? <button type="button" onClick={onRemove} className={completedActionTone === 'danger' ? 'text-red-300 hover:text-red-200' : 'font-semibold text-ap-copper hover:text-ap-ivory'}>{completedActionLabel}</button> : null}
    </div>
    </>}
  </article>
}

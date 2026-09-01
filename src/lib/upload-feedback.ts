export type UploadFeedbackStatus = 'idle' | 'analyzing' | 'ready' | 'preparing' | 'uploading' | 'saving' | 'complete' | 'error' | 'cancelled'

export interface UploadProgressSnapshot {
  loaded: number
  total: number
  startedAt: number
  now?: number
}

export interface EstimatedUploadProgress {
  percentage: number | null
  bytesPerSecond: number
  secondsRemaining: number | null
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = Math.round((bytes / (1024 ** exponent)) * 10) / 10
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`
}

export function formatRemainingTime(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return 'Calculando…'
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`
  return `${Math.max(1, Math.round(seconds / 60))} min`
}

export function estimateUploadProgress({ loaded, total, startedAt, now = Date.now() }: UploadProgressSnapshot): EstimatedUploadProgress {
  if (!total || total <= 0) return { percentage: null, bytesPerSecond: 0, secondsRemaining: null }

  const elapsedSeconds = Math.max((now - startedAt) / 1000, 0.001)
  const bytesPerSecond = loaded / elapsedSeconds
  const remainingBytes = Math.max(total - loaded, 0)

  return {
    percentage: Math.min(100, Math.round((loaded / total) * 100)),
    bytesPerSecond,
    secondsRemaining: bytesPerSecond > 0 ? remainingBytes / bytesPerSecond : null,
  }
}

export function getUploadStatusLabel(status: UploadFeedbackStatus) {
  const labels: Record<UploadFeedbackStatus, string> = {
    idle: 'Seleccioná un archivo',
    analyzing: 'Leyendo archivo…',
    ready: 'Listo para cargar',
    preparing: 'Preparando carga…',
    uploading: 'Subiendo archivo…',
    saving: 'Guardando archivo…',
    complete: 'Archivo cargado',
    error: 'No se pudo completar la carga',
    cancelled: 'Carga cancelada',
  }
  return labels[status]
}

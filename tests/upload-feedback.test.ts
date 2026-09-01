import {
  estimateUploadProgress,
  formatFileSize,
  formatRemainingTime,
  getUploadStatusLabel,
} from '@/lib/upload-feedback'

describe('upload feedback helpers', () => {
  it('formats file sizes for the upload card', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(121.5 * 1024 * 1024)).toBe('121.5 MB')
  })

  it('calculates progress, speed and remaining time from real transfer bytes', () => {
    const progress = estimateUploadProgress({ loaded: 40, total: 100, startedAt: 1_000, now: 5_000 })

    expect(progress.percentage).toBe(40)
    expect(progress.bytesPerSecond).toBe(10)
    expect(progress.secondsRemaining).toBe(6)
  })

  it('does not invent timing when there is no computable transfer total', () => {
    const progress = estimateUploadProgress({ loaded: 40, total: 0, startedAt: 1_000, now: 5_000 })

    expect(progress.percentage).toBeNull()
    expect(progress.secondsRemaining).toBeNull()
  })

  it('uses clear Spanish labels for each user-visible state', () => {
    expect(getUploadStatusLabel('ready')).toBe('Listo para cargar')
    expect(getUploadStatusLabel('saving')).toBe('Guardando archivo…')
    expect(getUploadStatusLabel('cancelled')).toBe('Carga cancelada')
  })

  it('formats the remaining time without displaying misleading precision', () => {
    expect(formatRemainingTime(null)).toBe('Calculando…')
    expect(formatRemainingTime(18)).toBe('18 s')
    expect(formatRemainingTime(125)).toBe('2 min')
  })
})

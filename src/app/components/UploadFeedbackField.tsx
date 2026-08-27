'use client'

import { useId, useRef, useState } from 'react'
import { startFormDataUpload } from '@/lib/form-data-upload'
import type { UploadFeedbackStatus } from '@/lib/upload-feedback'
import { UploadFeedbackCard } from './UploadFeedbackCard'

interface UploadFeedbackFieldProps<T> {
  label: string
  helperText: string
  accept: string
  maxBytes: number
  endpoint: string
  createFormData: (file: File) => FormData
  getResult: (payload: unknown) => T
  onUploaded: (result: T, file: File) => void
  onFileSelected?: (file: File) => void
  onFileCleared?: () => void
  selectLabel?: string
  allowedTypes?: string[]
  disabled?: boolean
}

function readUploadError(payload: unknown) {
  if (!payload || typeof payload !== 'object') return 'El servidor no confirmó la carga. Intentá de nuevo.'
  const error = 'error' in payload ? payload.error : undefined
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return 'El servidor no confirmó la carga. Intentá de nuevo.'
}

export function UploadFeedbackField<T>({
  label,
  helperText,
  accept,
  maxBytes,
  endpoint,
  createFormData,
  getResult,
  onUploaded,
  onFileSelected,
  onFileCleared,
  selectLabel = 'Seleccionar archivo',
  allowedTypes,
  disabled = false,
}: UploadFeedbackFieldProps<T>) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const taskRef = useRef<ReturnType<typeof startFormDataUpload> | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<UploadFeedbackStatus>('idle')
  const [loaded, setLoaded] = useState(0)
  const [total, setTotal] = useState(0)
  const [startedAt, setStartedAt] = useState<number | undefined>()
  const [error, setError] = useState<string | null>(null)

  function chooseFile(nextFile: File | undefined) {
    if (!nextFile) return
    setError(null)
    if (allowedTypes?.length && !allowedTypes.includes(nextFile.type)) {
      setStatus('error')
      setError('Este formato no está permitido en esta carga.')
      return
    }
    if (nextFile.size > maxBytes) {
      setStatus('error')
      setError(`El archivo supera el límite de ${(maxBytes / (1024 * 1024)).toFixed(0)} MB.`)
      return
    }
    setFile(nextFile)
    setLoaded(0)
    setTotal(nextFile.size)
    setStatus('ready')
    onFileSelected?.(nextFile)
  }

  async function upload() {
    if (!file) return
    setError(null)
    setStatus('preparing')
    const started = Date.now()
    setStartedAt(started)
    try {
      const task = startFormDataUpload<unknown>({
        url: endpoint,
        formData: createFormData(file),
        onProgress: (progress) => {
          setStatus('uploading')
          setLoaded(progress.loaded)
          setTotal(progress.total)
        },
      })
      taskRef.current = task
      const payload = await task.promise
      setStatus('saving')
      const result = getResult(payload)
      onUploaded(result, file)
      setLoaded(file.size)
      setTotal(file.size)
      setStatus('complete')
    } catch (uploadError) {
      if (uploadError instanceof DOMException && uploadError.name === 'AbortError') {
        setStatus('cancelled')
        return
      }
      setStatus('error')
      setError(uploadError instanceof Error ? uploadError.message : readUploadError(uploadError))
    } finally {
      taskRef.current = null
    }
  }

  function clearSelection() {
    setFile(null)
    setError(null)
    setLoaded(0)
    setTotal(0)
    setStartedAt(undefined)
    setStatus('idle')
    onFileCleared?.()
    if (inputRef.current) inputRef.current.value = ''
  }

  return <div className="space-y-3">
    <div className="space-y-2">
      <span className="text-sm font-medium text-white/75">{label}</span>
      <label htmlFor={inputId} className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/25 bg-white/[0.03] px-5 py-7 text-center transition hover:border-ap-copper/70 hover:bg-ap-copper/5 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        <input ref={inputRef} id={inputId} type="file" accept={accept} className="sr-only" disabled={disabled || status === 'preparing' || status === 'uploading' || status === 'saving'} onChange={(event) => chooseFile(event.target.files?.[0])} />
        <span className="text-sm font-medium text-ap-copper">{file ? 'Reemplazar archivo' : selectLabel}</span>
        <span className="text-xs text-white/45">{helperText}</span>
      </label>
    </div>
    {file ? <UploadFeedbackCard file={file} status={status} loaded={loaded} total={total} startedAt={startedAt} error={error} onStart={() => void upload()} onRetry={() => void upload()} onCancel={() => taskRef.current?.abort()} onRemove={clearSelection} completedActionLabel="Cargar otro archivo" completedActionTone="default" /> : null}
    {!file && error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
  </div>
}

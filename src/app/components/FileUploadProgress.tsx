'use client'

import { useRef, useState } from 'react'
import { UploadFeedbackCard } from './UploadFeedbackCard'
import type { UploadFeedbackStatus } from '@/lib/upload-feedback'
import {
  assertValidUploadFileSize,
  buildUploadRequestMetadata,
  type LearningUploadScope,
} from '@/lib/upload-contract'

interface FileUploadProgressProps {
  onUploadComplete: (file: UploadedFile) => void
  uploadType: 'video' | 'resource'
  moduleId?: string
  lessonId?: string
  courseId?: string
  deferPersistence?: boolean
  learningScope?: LearningUploadScope
  learningScopeId?: string
  accept?: string
  maxSize?: number
}

export interface UploadedFile {
  fileUrl: string
  fileName: string
  fileSize: number
  fileType: string
  uploadedAt: string
}

const MB = 1024 * 1024
const RESOURCE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt'
const VIDEO_ACCEPT = 'video/*'
const RESOURCE_MAX_MB = 100
const VIDEO_MAX_MB = 3072

export default function FileUploadProgress({
  onUploadComplete,
  uploadType,
  moduleId,
  lessonId,
  courseId,
  deferPersistence,
  learningScope,
  learningScopeId,
  accept,
  maxSize,
}: FileUploadProgressProps) {
  const effectiveAccept = accept ?? (uploadType === 'video' ? VIDEO_ACCEPT : RESOURCE_ACCEPT)
  const effectiveMaxSize = maxSize ?? (uploadType === 'video' ? VIDEO_MAX_MB : RESOURCE_MAX_MB)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [status, setStatus] = useState<UploadFeedbackStatus>('idle')
  const [loaded, setLoaded] = useState(0)
  const [total, setTotal] = useState(0)
  const [startedAt, setStartedAt] = useState<number | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeRequestRef = useRef<XMLHttpRequest | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const isUploading = status === 'preparing' || status === 'uploading' || status === 'saving'

  function clearSelection() {
    setSelectedFile(null)
    setStatus('idle')
    setLoaded(0)
    setTotal(0)
    setStartedAt(undefined)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileSelect(file: File) {
    setError(null)
    try {
      assertValidUploadFileSize(uploadType, file.size)
    } catch (validationError) {
      setStatus('error')
      setSelectedFile(null)
      setError(validationError instanceof Error ? validationError.message : 'El tamaño del archivo no es válido.')
      return
    }
    if (file.size > effectiveMaxSize * MB) {
      setStatus('error')
      setSelectedFile(null)
      setError(`Archivo demasiado grande. Máximo ${effectiveMaxSize} MB.`)
      return
    }
    setSelectedFile(file)
    setLoaded(0)
    setTotal(file.size)
    setStartedAt(undefined)
    setStatus('ready')
    void handleUpload(file)
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (file) handleFileSelect(file)
  }

  async function handleUpload(fileToUpload = selectedFile) {
    if (!fileToUpload || isUploading) return

    const controller = new AbortController()
    controllerRef.current = controller
    setError(null)
    setLoaded(0)
    setTotal(fileToUpload.size)
    setStartedAt(Date.now())
    setStatus('preparing')

    try {
      const uploadMetadata = buildUploadRequestMetadata(fileToUpload, {
        uploadType,
        moduleId,
        lessonId,
        courseId,
        deferPersistence,
        learningScope,
        learningScopeId,
      })
      const presignedRes = await fetch('/api/uploads/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadMetadata),
        signal: controller.signal,
      })

      const presignedPayload = await presignedRes.json().catch(() => ({}))
      if (!presignedRes.ok) throw new Error(presignedPayload.error || 'No se pudo preparar la carga.')
      const { presignedUrl, fileUrl } = presignedPayload.data

      setStatus('uploading')
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest()
        activeRequestRef.current = request
        request.open('PUT', presignedUrl)
        request.setRequestHeader('Content-Type', fileToUpload.type)
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setLoaded(event.loaded)
            setTotal(event.total)
          }
        }
        request.onload = () => {
          activeRequestRef.current = null
          if (request.status >= 200 && request.status < 300) resolve()
          else reject(new Error(`R2 rechazó la carga (${request.status}).`))
        }
        request.onerror = () => { activeRequestRef.current = null; reject(new Error('Se perdió la conexión durante la carga.')) }
        request.onabort = () => { activeRequestRef.current = null; reject(new DOMException('Carga cancelada.', 'AbortError')) }
        request.send(fileToUpload)
      })

      setStatus('saving')
      const confirmRes = await fetch('/api/uploads/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...uploadMetadata,
          fileUrl,
          mimeType: fileToUpload.type,
        }),
        signal: controller.signal,
      })
      const confirmPayload = await confirmRes.json().catch(() => ({}))
      if (!confirmRes.ok) throw new Error(confirmPayload.error || 'No se pudo guardar el archivo.')

      setLoaded(fileToUpload.size)
      setTotal(fileToUpload.size)
      setStatus('complete')
      onUploadComplete(confirmPayload.data)
    } catch (uploadError) {
      if (uploadError instanceof DOMException && uploadError.name === 'AbortError') {
        setStatus('cancelled')
        return
      }
      setStatus('error')
      setError(uploadError instanceof Error ? uploadError.message : 'No se pudo subir el archivo.')
    } finally {
      activeRequestRef.current = null
      controllerRef.current = null
    }
  }

  function cancelUpload() {
    controllerRef.current?.abort()
    activeRequestRef.current?.abort()
  }

  return <div className="space-y-3">
    <div
      onDragOver={(event) => { event.preventDefault(); if (!isUploading) setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        const file = event.dataTransfer.files?.[0]
        if (file && !isUploading) handleFileSelect(file)
      }}
      className={`${isUploading ? 'hidden' : ''} rounded-2xl border border-dashed p-6 text-center transition-colors ${isDragging ? 'border-ap-copper bg-ap-copper/5' : 'border-white/20 bg-white/[0.03] hover:border-white/35'}`}
    >
      <input ref={fileInputRef} type="file" accept={effectiveAccept} onChange={handleInputChange} className="sr-only" id={`file-upload-${uploadType}-${moduleId ?? courseId ?? 'new'}`} disabled={isUploading} />
      <label htmlFor={`file-upload-${uploadType}-${moduleId ?? courseId ?? 'new'}`} className={`block ${isUploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
        <span className="text-sm font-medium text-ap-copper">{selectedFile ? 'Reemplazar archivo' : 'Seleccionar archivo'}</span>
        <span className="mt-2 block text-xs text-white/45">{uploadType === 'resource' ? `PDF, imágenes, Word, Excel, PPT o ZIP · máximo ${effectiveMaxSize} MB` : `MP4, WebM o MOV · máximo ${effectiveMaxSize} MB`}</span>
      </label>
    </div>
    {selectedFile ? <UploadFeedbackCard file={selectedFile} status={status} loaded={loaded} total={total} startedAt={startedAt} error={error} onStart={() => void handleUpload()} onRetry={() => void handleUpload()} onCancel={cancelUpload} onRemove={clearSelection} completedActionLabel="Cargar otro archivo" completedActionTone="default" /> : null}
    {!selectedFile && error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
  </div>
}

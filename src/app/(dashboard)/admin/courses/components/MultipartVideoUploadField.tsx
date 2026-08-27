'use client'

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { validateVideoUpload } from '@/lib/video-upload'

type UploadStatus = 'idle' | 'analyzing' | 'ready' | 'preparing' | 'uploading' | 'finishing' | 'complete'

interface VideoMetadata {
  file: File
  duration: number | null
  width: number | null
  height: number | null
}

interface UploadProgress {
  loaded: number
  total: number
  bytesPerSecond: number
}

interface MultipartSession {
  uploadId: string
  key: string
  fileUrl: string
  partSize: number
  partCount: number
}

const SIGNED_PART_BATCH_SIZE = 8
const PART_UPLOAD_RETRIES = 2

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatDuration(seconds: number | null) {
  if (!seconds || !Number.isFinite(seconds)) return 'Duración no disponible'
  const totalSeconds = Math.round(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function formatRemainingTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Calculando…'
  const rounded = Math.ceil(seconds)
  const minutes = Math.floor(rounded / 60)
  const remainingSeconds = rounded % 60
  return minutes > 0 ? `${minutes} min ${remainingSeconds} s` : `${remainingSeconds} s`
}

function getVideoMetadata(file: File): Promise<Pick<VideoMetadata, 'duration' | 'width' | 'height'>> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const finish = (metadata: Pick<VideoMetadata, 'duration' | 'width' | 'height'>) => {
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
      resolve(metadata)
    }
    video.preload = 'metadata'
    video.onloadedmetadata = () => finish({
      duration: Number.isFinite(video.duration) ? video.duration : null,
      width: video.videoWidth || null,
      height: video.videoHeight || null,
    })
    video.onerror = () => finish({ duration: null, width: null, height: null })
    video.src = url
  })
}

async function requestMultipart<T>(action: string, data: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/uploads/multipart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
    signal,
  })
  const result = await response.json()
  if (!response.ok || !result.ok) throw new Error(result.error || 'No se pudo preparar la carga multipart.')
  return result.data as T
}

function uploadPart(url: string, part: Blob, onProgress: (loaded: number) => void, onRequest: (request: XMLHttpRequest | null) => void) {
  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest()
    onRequest(request)
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded)
    }
    request.onload = () => {
      onRequest(null)
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`R2 rechazó una parte del video (${request.status}).`))
        return
      }
      const eTag = request.getResponseHeader('ETag')
      if (!eTag) {
        reject(new Error('R2 no devolvió la confirmación de una parte. Agregá ETag a ExposeHeaders de la política CORS del bucket.'))
        return
      }
      resolve(eTag)
    }
    request.onerror = () => { onRequest(null); reject(new Error('Se perdió la conexión al subir una parte del video.')) }
    request.onabort = () => { onRequest(null); reject(new DOMException('Carga cancelada.', 'AbortError')) }
    request.open('PUT', url)
    request.setRequestHeader('Content-Type', part.type || 'application/octet-stream')
    request.send(part)
  })
}

async function uploadPartWithRetry(url: string, part: Blob, onProgress: (loaded: number) => void, onRequest: (request: XMLHttpRequest | null) => void, onRetry: (attempt: number) => void) {
  for (let attempt = 0; attempt <= PART_UPLOAD_RETRIES; attempt += 1) {
    try {
      return await uploadPart(url, part, onProgress, onRequest)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      if (attempt === PART_UPLOAD_RETRIES) throw error
      onRetry(attempt + 1)
    }
  }
  throw new Error('No se pudo subir la parte del video.')
}

export function MultipartVideoUploadField({ courseId, label, value, onChange }: { courseId: string; label: string; value: string | null; onChange: (url: string | null) => void }) {
  const inputId = useId()
  const [selectedVideo, setSelectedVideo] = useState<VideoMetadata | null>(null)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const activeRequestRef = useRef<XMLHttpRequest | null>(null)
  const sessionRef = useRef<Pick<MultipartSession, 'uploadId' | 'key'> | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const cancelledRef = useRef(false)
  const selectionRef = useRef(0)
  const lastProgressUpdateRef = useRef(0)

  const isUploading = status === 'preparing' || status === 'uploading' || status === 'finishing'
  const percentage = progress ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0
  const secondsRemaining = progress && progress.bytesPerSecond > 0 ? (progress.total - progress.loaded) / progress.bytesPerSecond : 0

  useEffect(() => () => {
    cancelledRef.current = true
    controllerRef.current?.abort()
    activeRequestRef.current?.abort()
  }, [])

  async function selectVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const validation = validateVideoUpload({ fileName: file.name, fileSize: file.size, contentType: file.type })
    if (!validation.valid) {
      setSelectedVideo(null)
      setStatus('idle')
      setUploadError(validation.error)
      return
    }

    const selection = ++selectionRef.current
    setStatus('analyzing')
    setProgress(null)
    setUploadError(null)
    setUploadNotice(null)
    const metadata = await getVideoMetadata(file)
    if (selection !== selectionRef.current) return
    setSelectedVideo({ file, ...metadata })
    setStatus('ready')
  }

  function updateProgress(loaded: number, total: number, startedAt: number) {
    const now = performance.now()
    if (loaded < total && now - lastProgressUpdateRef.current < 150) return
    lastProgressUpdateRef.current = now
    const elapsedSeconds = Math.max((now - startedAt) / 1000, 0.1)
    setProgress({ loaded, total, bytesPerSecond: loaded / elapsedSeconds })
  }

  async function startUpload() {
    if (!selectedVideo || isUploading) return

    const { file } = selectedVideo
    const controller = new AbortController()
    const startedAt = performance.now()
    let session: MultipartSession | null = null
    cancelledRef.current = false
    controllerRef.current = controller
    lastProgressUpdateRef.current = 0
    setUploadError(null)
    setUploadNotice(null)
    setProgress({ loaded: 0, total: file.size, bytesPerSecond: 0 })
    setStatus('preparing')

    try {
      session = await requestMultipart<MultipartSession>('create', {
        courseId,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
      }, controller.signal)
      sessionRef.current = { uploadId: session.uploadId, key: session.key }
      let completedBytes = 0
      const uploadedParts: Array<{ partNumber: number; eTag: string }> = []

      for (let firstPart = 1; firstPart <= session.partCount; firstPart += SIGNED_PART_BATCH_SIZE) {
        const partNumbers = Array.from({ length: Math.min(SIGNED_PART_BATCH_SIZE, session.partCount - firstPart + 1) }, (_, index) => firstPart + index)
        const signed = await requestMultipart<{ parts: Array<{ partNumber: number; presignedUrl: string }> }>('sign-parts', {
          key: session.key,
          uploadId: session.uploadId,
          partNumbers,
        }, controller.signal)

        for (const { partNumber, presignedUrl } of signed.parts) {
          if (cancelledRef.current) throw new DOMException('Carga cancelada.', 'AbortError')
          const partStart = (partNumber - 1) * session.partSize
          const part = file.slice(partStart, Math.min(partStart + session.partSize, file.size), file.type)
          setStatus('uploading')
          const eTag = await uploadPartWithRetry(presignedUrl, part, (partLoaded) => updateProgress(completedBytes + partLoaded, file.size, startedAt), (request) => { activeRequestRef.current = request }, (attempt) => setUploadNotice(`Reconectando la carga: reintentando una parte (${attempt}/${PART_UPLOAD_RETRIES})…`))
          completedBytes += part.size
          updateProgress(completedBytes, file.size, startedAt)
          setUploadNotice(null)
          uploadedParts.push({ partNumber, eTag })
        }
      }

      setStatus('finishing')
      const completed = await requestMultipart<{ fileUrl: string }>('complete', {
        key: session.key,
        uploadId: session.uploadId,
        parts: uploadedParts,
      }, controller.signal)
      onChange(completed.fileUrl)
      setProgress({ loaded: file.size, total: file.size, bytesPerSecond: file.size / Math.max((performance.now() - startedAt) / 1000, 0.1) })
      setStatus('complete')
      setUploadNotice('Video cargado. Guardá el borrador o publicá para asociarlo a la lección.')
    } catch (error) {
      if (cancelledRef.current || (error instanceof DOMException && error.name === 'AbortError')) return
      setStatus('ready')
      setUploadError(error instanceof Error ? error.message : 'No se pudo subir el video.')
      if (session) void requestMultipart('abort', { key: session.key, uploadId: session.uploadId }).catch(() => undefined)
    } finally {
      activeRequestRef.current = null
      controllerRef.current = null
      sessionRef.current = null
    }
  }

  function cancelUpload() {
    if (!isUploading) return
    cancelledRef.current = true
    controllerRef.current?.abort()
    activeRequestRef.current?.abort()
    const session = sessionRef.current
    if (session) void requestMultipart('abort', session).catch(() => undefined)
    setStatus('ready')
    setProgress(null)
    setUploadNotice('Carga cancelada. Podés intentarlo de nuevo.')
  }

  return <div className="space-y-3"><div className="space-y-2"><span className="text-sm font-medium text-white/75">{label}</span><label htmlFor={inputId} className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/25 bg-white/[0.03] px-5 py-7 text-center transition hover:border-ap-copper/70 hover:bg-ap-copper/5"><input id={inputId} type="file" accept="video/mp4,video/webm,video/quicktime,video/mpeg" className="sr-only" disabled={isUploading} onChange={selectVideo} /><span className="text-sm font-medium text-ap-copper">{isUploading ? 'Carga en curso…' : value ? 'Reemplazar video' : 'Seleccionar video'}</span><span className="text-xs text-white/45">MP4, WebM, MOV o MPEG · máximo 10 GB · carga multipart segura</span></label></div>{selectedVideo ? <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{selectedVideo.file.name}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55"><span>{formatBytes(selectedVideo.file.size)}</span><span>Duración: {formatDuration(selectedVideo.duration)}</span>{selectedVideo.width && selectedVideo.height ? <span>{selectedVideo.width} × {selectedVideo.height}</span> : null}</div></div>{status === 'ready' || status === 'complete' ? <button type="button" onClick={() => void startUpload()} className="shrink-0 rounded-xl bg-ap-copper px-4 py-2 text-sm font-semibold text-white hover:brightness-110">{status === 'complete' ? 'Subir nuevamente' : 'Iniciar carga'}</button> : null}</div>{isUploading || progress ? <div className="mt-4 space-y-2"><div className="flex items-center justify-between gap-3 text-xs text-white/60"><span>{status === 'preparing' ? 'Preparando carga segura…' : status === 'finishing' ? 'Finalizando video en R2…' : `Subiendo ${percentage}%`}</span><span>{formatBytes(progress?.loaded ?? 0)} de {formatBytes(selectedVideo.file.size)}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-ap-copper transition-[width] duration-200" style={{ width: `${percentage}%` }} /></div>{progress && status === 'uploading' ? <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45"><span>{formatBytes(progress.bytesPerSecond)}/s</span><span>Tiempo restante: {formatRemainingTime(secondsRemaining)}</span></div> : null}{isUploading ? <button type="button" onClick={cancelUpload} className="text-sm text-red-300 hover:text-red-200">Cancelar carga</button> : null}</div> : null}</article> : null}{status === 'analyzing' ? <p className="text-sm text-white/55">Leyendo duración y tamaño del video…</p> : null}{uploadError ? <p role="alert" className="text-sm text-red-300">{uploadError}</p> : null}{uploadNotice ? <p className="text-sm text-ap-copper">{uploadNotice}</p> : null}{value ? <div className="overflow-hidden rounded-xl border border-white/10 bg-black"><video controls preload="metadata" src={value} className="aspect-video w-full" /><button type="button" onClick={() => onChange(null)} className="px-3 py-2 text-sm text-red-300 hover:text-red-200">Quitar video</button></div> : null}</div>
}

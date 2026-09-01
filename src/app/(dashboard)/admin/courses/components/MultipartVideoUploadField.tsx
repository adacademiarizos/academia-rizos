'use client'

import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { validateVideoUpload } from '@/lib/video-upload'
import { UploadFeedbackCard } from '@/app/components/UploadFeedbackCard'
import type { UploadFeedbackStatus } from '@/lib/upload-feedback'

type UploadStatus = 'idle' | 'analyzing' | 'ready' | 'preparing' | 'uploading' | 'finishing' | 'complete' | 'cancelled'

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
  const [isReplacing, setIsReplacing] = useState(false)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<number | undefined>(undefined)
  const activeRequestRef = useRef<XMLHttpRequest | null>(null)
  const sessionRef = useRef<Pick<MultipartSession, 'uploadId' | 'key'> | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const cancelledRef = useRef(false)
  const selectionRef = useRef(0)
  const lastProgressUpdateRef = useRef(0)

  const isUploading = status === 'preparing' || status === 'uploading' || status === 'finishing'
  const showUploader = !value || isReplacing
  const feedbackStatus: UploadFeedbackStatus = status === 'analyzing'
    ? 'analyzing'
    : status === 'preparing' || status === 'finishing'
      ? 'saving'
      : status === 'uploading'
        ? 'uploading'
        : status === 'complete'
          ? 'complete'
          : status === 'cancelled'
            ? 'cancelled'
          : uploadError
            ? 'error'
            : 'ready'

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
      setStartedAt(undefined)
      setUploadError(validation.error)
      return
    }

    const selection = ++selectionRef.current
    setStatus('analyzing')
    setProgress(null)
    setUploadError(null)
    setStartedAt(undefined)
    const nextVideo: VideoMetadata = { file, duration: null, width: null, height: null }
    setSelectedVideo(nextVideo)
    void startUpload(nextVideo)
    const metadata = await getVideoMetadata(file)
    if (selection !== selectionRef.current) return
    setSelectedVideo((currentVideo) => currentVideo?.file === file ? { ...currentVideo, ...metadata } : currentVideo)
  }

  function updateProgress(loaded: number, total: number, startedAt: number) {
    const now = performance.now()
    if (loaded < total && now - lastProgressUpdateRef.current < 150) return
    lastProgressUpdateRef.current = now
    const elapsedSeconds = Math.max((now - startedAt) / 1000, 0.1)
    setProgress({ loaded, total, bytesPerSecond: loaded / elapsedSeconds })
  }

  async function startUpload(videoToUpload = selectedVideo) {
    if (!videoToUpload || isUploading) return

    const { file } = videoToUpload
    const controller = new AbortController()
    const performanceStartedAt = performance.now()
    let session: MultipartSession | null = null
    cancelledRef.current = false
    controllerRef.current = controller
    lastProgressUpdateRef.current = 0
    setUploadError(null)
    setStartedAt(Date.now())
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
          const eTag = await uploadPartWithRetry(presignedUrl, part, (partLoaded) => updateProgress(completedBytes + partLoaded, file.size, performanceStartedAt), (request) => { activeRequestRef.current = request }, () => undefined)
          completedBytes += part.size
          updateProgress(completedBytes, file.size, performanceStartedAt)
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
      setProgress({ loaded: file.size, total: file.size, bytesPerSecond: file.size / Math.max((performance.now() - performanceStartedAt) / 1000, 0.1) })
      setStatus('complete')
      setIsReplacing(false)
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
    setStatus('cancelled')
    setProgress(null)
    setStartedAt(undefined)
  }

  function clearSelection() {
    if (isUploading) cancelUpload()
    selectionRef.current += 1
    setSelectedVideo(null)
    setStatus('idle')
    setProgress(null)
    setUploadError(null)
    setStartedAt(undefined)
  }

  function beginReplacement() {
    selectionRef.current += 1
    setSelectedVideo(null)
    setStatus('idle')
    setProgress(null)
    setUploadError(null)
    setStartedAt(undefined)
    setIsReplacing(true)
  }

  function removeVideo() {
    selectionRef.current += 1
    setSelectedVideo(null)
    setStatus('idle')
    setProgress(null)
    setUploadError(null)
    setStartedAt(undefined)
    setIsReplacing(false)
    onChange(null)
  }

  return <div className="space-y-3">
    <span className="text-sm font-medium text-white/75">{label}</span>

    {value && !isReplacing ? <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-white/15 bg-black">
        <video controls preload="metadata" src={value} className="aspect-video w-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={beginReplacement} className="h-10 rounded-xl bg-[#646a40] px-3 text-sm font-medium text-white transition hover:bg-[#747b4b]">Reemplazar</button>
        <button type="button" onClick={removeVideo} className="h-10 rounded-xl border border-red-300/20 bg-red-400/10 px-3 text-sm font-medium text-red-300 transition hover:bg-red-400/20">Eliminar</button>
      </div>
    </div> : null}

    {showUploader ? <div className="space-y-2">
      <label htmlFor={inputId} className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/25 bg-white/[0.03] px-5 py-7 text-center transition hover:border-ap-copper/70 hover:bg-ap-copper/5 ${isUploading ? 'hidden' : ''}`}>
        <input id={inputId} type="file" accept="video/mp4,video/webm,video/quicktime,video/mpeg" className="sr-only" disabled={isUploading} onChange={selectVideo} />
        <span className="text-sm font-medium text-ap-copper">{value ? 'Reemplazar video' : 'Seleccionar video'}</span>
        <span className="text-xs text-white/45">MP4, WebM, MOV o MPEG · máximo 10 GB · carga multipart segura</span>
      </label>
    </div> : null}

    {selectedVideo && feedbackStatus !== 'complete' ? <UploadFeedbackCard
      file={selectedVideo.file}
      status={feedbackStatus}
      loaded={progress?.loaded ?? 0}
      total={progress?.total ?? selectedVideo.file.size}
      startedAt={startedAt}
      error={uploadError}
      metadata={<>
        <span>Duración: {formatDuration(selectedVideo.duration)}</span>
        {selectedVideo.width && selectedVideo.height ? <span>{selectedVideo.width} × {selectedVideo.height}</span> : null}
      </>}
      onRetry={() => void startUpload()}
      onCancel={cancelUpload}
      onRemove={clearSelection}
      completedActionLabel="Cargar otro archivo"
      completedActionTone="default"
    /> : null}

    {!selectedVideo && uploadError ? <p role="alert" className="text-sm text-red-300">{uploadError}</p> : null}

    {value && isReplacing ? <button type="button" onClick={() => setIsReplacing(false)} className="text-sm text-white/55 transition hover:text-white/80">Cancelar reemplazo</button> : null}
  </div>
}

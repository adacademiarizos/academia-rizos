'use client'

import { useState, useRef } from 'react'

interface FileUploadProgressProps {
  onUploadComplete: (file: UploadedFile) => void
  uploadType: 'video' | 'resource'
  moduleId?: string
  lessonId?: string
  courseId?: string
  accept?: string
  maxSize?: number // in MB
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
const VIDEO_MAX_MB = 3072 // 3 GB

export default function FileUploadProgress({
  onUploadComplete,
  uploadType,
  moduleId,
  lessonId,
  courseId,
  accept,
  maxSize,
}: FileUploadProgressProps) {
  const effectiveAccept = accept ?? (uploadType === 'video' ? VIDEO_ACCEPT : RESOURCE_ACCEPT)
  const effectiveMaxSize = maxSize ?? (uploadType === 'video' ? VIDEO_MAX_MB : RESOURCE_MAX_MB)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    setError(null)
    setSuccess(false)
    if (file.size > effectiveMaxSize * MB) {
      setError(`Archivo demasiado grande. Máx ${effectiveMaxSize} MB`)
      return
    }
    setSelectedFile(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files[0]) handleFileSelect(files[0])
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files && files[0]) handleFileSelect(files[0])
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      // Step 1: Get presigned PUT URL from server (tiny request, no file data)
      const presignedRes = await fetch('/api/uploads/presigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: selectedFile.type,
          fileSize: selectedFile.size,
          uploadType,
          moduleId,
          lessonId,
          courseId,
          fileName: selectedFile.name,
        }),
      })

      if (!presignedRes.ok) {
        const d = await presignedRes.json().catch(() => ({}))
        throw new Error(d.error || 'Error al obtener URL de subida')
      }

      const { data: { presignedUrl, fileUrl } } = await presignedRes.json()

      // Step 2: Upload file directly to R2 via presigned URL (bypasses Vercel — supports up to 3GB)
      // Using XHR instead of fetch so we get real upload progress events
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', presignedUrl)
        xhr.setRequestHeader('Content-Type', selectedFile.type)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 95))
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Error al subir archivo (${xhr.status})`))
          }
        }
        xhr.onerror = () => reject(new Error('Error de red al subir archivo'))
        xhr.send(selectedFile)
      })

      // Step 3: Confirm with server to update the DB
      const confirmRes = await fetch('/api/uploads/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type,
          uploadType,
          moduleId,
          lessonId,
          courseId,
        }),
      })

      if (!confirmRes.ok) {
        const d = await confirmRes.json().catch(() => ({}))
        throw new Error(d.error || 'Error al confirmar subida')
      }

      const { data } = await confirmRes.json()
      setUploadProgress(100)
      setSuccess(true)
      onUploadComplete(data)

      setTimeout(() => {
        setSelectedFile(null)
        setUploadProgress(0)
        setSuccess(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir')
      setUploadProgress(0)
    } finally {
      setIsUploading(false)
    }
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return '🖼️'
    if (file.type === 'application/pdf') return '📄'
    if (file.type.startsWith('video/')) return '🎥'
    if (file.type.includes('word') || file.type.includes('document')) return '📝'
    if (file.type.includes('sheet') || file.type.includes('excel')) return '📊'
    if (file.type.includes('presentation') || file.type.includes('powerpoint')) return '📊'
    if (file.type === 'application/zip') return '🗜️'
    return '📎'
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-2xl border border-dashed p-6 text-center transition-colors ${
          isDragging
            ? 'border-white/40 bg-white/10'
            : 'border-white/20 bg-white/5 hover:border-white/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={effectiveAccept}
          onChange={handleInputChange}
          className="hidden"
          id="file-upload-input"
        />

        {!selectedFile ? (
          <label htmlFor="file-upload-input" className="cursor-pointer block">
            <div className="text-3xl mb-2">
              {uploadType === 'video' ? '🎥' : '📁'}
            </div>
            <p className="text-sm text-white/50">
              Arrastrá un archivo o{' '}
              <button
                type="button"
                className="text-[#c8cf94] hover:text-white transition underline"
                onClick={() => fileInputRef.current?.click()}
              >
                seleccioná uno
              </button>
            </p>
            <p className="text-xs text-white/25 mt-1">
              {uploadType === 'resource'
                ? 'PDF, imágenes, Word, Excel, PPT, ZIP · máx ' + effectiveMaxSize + ' MB'
                : 'MP4, WebM, MOV · máx ' + effectiveMaxSize + ' MB'}
            </p>
          </label>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="text-2xl">{getFileIcon(selectedFile)}</div>
            <p className="text-sm text-white/80 break-all">{selectedFile.name}</p>
            <p className="text-xs text-white/40">
              {(selectedFile.size / MB).toFixed(2)} MB
            </p>

            {isUploading && (
              <div className="w-full bg-white/10 rounded-full h-1.5 mt-1">
                <div
                  className="bg-[#646a40] h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {!isUploading && (
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleUpload}
                  className="px-4 py-1.5 rounded-xl bg-[#646a40] text-xs font-semibold text-white hover:opacity-90 transition"
                >
                  Subir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null)
                    setError(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="px-4 py-1.5 rounded-xl bg-white/10 text-xs text-white/60 hover:bg-white/15 transition"
                >
                  Cancelar
                </button>
              </div>
            )}

            {isUploading && (
              <p className="text-xs text-white/40">Subiendo… {uploadProgress}%</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 px-1">{error}</p>
      )}

      {success && (
        <p className="text-xs text-green-400 px-1">✓ Archivo subido correctamente</p>
      )}
    </div>
  )
}

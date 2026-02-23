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

export default function FileUploadProgress({
  onUploadComplete,
  uploadType,
  moduleId,
  lessonId,
  courseId,
  accept = uploadType === 'video' ? 'video/*' : '.pdf,.jpg,.jpeg,.png,.doc,.docx',
  maxSize = uploadType === 'video' ? 2000 : 50, // MB
}: FileUploadProgressProps) {
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

    // Validate file size
    if (file.size > maxSize * MB) {
      setError(`File too large. Max size is ${maxSize}MB`)
      return
    }

    setSelectedFile(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files[0]) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files && files[0]) {
      handleFileSelect(files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const params = new URLSearchParams()
      params.append('type', uploadType)
      if (moduleId) params.append('moduleId', moduleId)
      if (lessonId) params.append('lessonId', lessonId)
      if (courseId) params.append('courseId', courseId)

      const response = await fetch(`/api/uploads?${params.toString()}`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await response.json()
      setUploadProgress(100)
      setSuccess(true)
      onUploadComplete(data.data)

      // Reset after success
      setTimeout(() => {
        setSelectedFile(null)
        setUploadProgress(0)
        setSuccess(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploadProgress(0)
    } finally {
      setIsUploading(false)
    }
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return '🖼️'
    } else if (file.type === 'application/pdf') {
      return '📄'
    } else if (file.type.startsWith('video/')) {
      return '🎥'
    } else if (file.type.includes('word') || file.type.includes('document')) {
      return '📝'
    } else if (file.type.includes('sheet') || file.type.includes('excel')) {
      return '📊'
    }
    return '📎'
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-ap-copper bg-orange-50'
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          id="file-input"
        />

        {!selectedFile ? (
          <label htmlFor="file-input" className="cursor-pointer block">
            <div className="text-4xl mb-2">📁</div>
            <p className="text-gray-700 font-medium">Drag and drop your file here</p>
            <p className="text-gray-500 text-sm mt-1">or</p>
            <button
              type="button"
              className="text-ap-copper hover:text-orange-700 font-medium mt-2"
              onClick={() => fileInputRef.current?.click()}
            >
              Browse files
            </button>
            <p className="text-gray-500 text-xs mt-2">Max size: {maxSize}MB</p>
          </label>
        ) : (
          <div className="space-y-3">
            <div className="text-3xl">{getFileIcon(selectedFile)}</div>
            <div>
              <p className="font-medium text-gray-800 break-all">{selectedFile.name}</p>
              <p className="text-sm text-gray-500">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>

            {/* Progress bar */}
            {isUploading && (
              <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                <div
                  className="bg-ap-copper h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 justify-center mt-4">
              {!isUploading ? (
                <>
                  <button
                    onClick={handleUpload}
                    className="px-4 py-2 bg-ap-copper text-white rounded hover:bg-orange-700 transition"
                  >
                    Upload
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFile(null)
                      setError(null)
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 transition"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <p className="text-gray-600">Uploading... {uploadProgress}%</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          ✓ File uploaded successfully
        </div>
      )}
    </div>
  )
}

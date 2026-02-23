'use client'

import { useState, useEffect } from 'react'
import FileUploadProgress, { UploadedFile } from './FileUploadProgress'

interface CourseResource {
  id: string
  title: string
  fileUrl: string
  fileType: string
  fileSize: number
  order: number
}

interface CourseResourceManagerProps {
  courseId: string
  onResourcesChange?: (resources: CourseResource[]) => void
}

const FILE_ICONS: Record<string, string> = {
  pdf: '📄',
  image: '🖼️',
  document: '📝',
  video: '🎥',
  other: '📎',
}

export default function CourseResourceManager({
  courseId,
  onResourcesChange,
}: CourseResourceManagerProps) {
  const [resources, setResources] = useState<CourseResource[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Fetch resources on mount
  useEffect(() => {
    fetchResources()
  }, [courseId])

  const fetchResources = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch(`/api/admin/courses/${courseId}/resources`)

      if (!response.ok) {
        throw new Error('Failed to fetch resources')
      }

      const data = await response.json()
      setResources(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading resources')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUploadComplete = async (uploadedFile: UploadedFile) => {
    try {
      // Create resource reference in database
      const response = await fetch(`/api/admin/courses/${courseId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: uploadedFile.fileName,
          fileUrl: uploadedFile.fileUrl,
          fileType: uploadedFile.fileType,
          fileSize: uploadedFile.fileSize,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save resource')
      }

      setShowUpload(false)
      await fetchResources()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving resource')
    }
  }

  const handleDeleteResource = async (resourceId: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) {
      return
    }

    try {
      const response = await fetch(
        `/api/admin/courses/${courseId}/resources/${resourceId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('Failed to delete resource')
      }

      await fetchResources()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting resource')
    }
  }

  const handleDragStart = (resourceId: string) => {
    setDraggedId(resourceId)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault()
    setDragOverIndex(null)

    if (!draggedId) return

    // Find the indices
    const draggedIndex = resources.findIndex((r) => r.id === draggedId)
    if (draggedIndex === targetIndex || draggedIndex === -1) return

    // Reorder resources locally
    const newResources = [...resources]
    const [movedResource] = newResources.splice(draggedIndex, 1)
    newResources.splice(targetIndex, 0, movedResource)

    // Update order numbers
    const updatedResources = newResources.map((r, index) => ({
      ...r,
      order: index,
    }))

    setResources(updatedResources)
    setDraggedId(null)

    // Update in database
    try {
      for (let i = 0; i < updatedResources.length; i++) {
        const resource = updatedResources[i]
        if (resource.order !== resources[i].order) {
          await fetch(`/api/admin/courses/${courseId}/resources/${resource.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: i }),
          })
        }
      }
    } catch (err) {
      console.error('Error updating resource order:', err)
      // Refresh to get correct order
      fetchResources()
    }

    if (onResourcesChange) {
      onResourcesChange(updatedResources)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  if (isLoading) {
    return <div className="text-center py-8 text-gray-600">Loading resources...</div>
  }

  return (
    <div className="space-y-4">
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Upload section */}
      {showUpload ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Upload New Resource</h3>
            <button
              onClick={() => setShowUpload(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <FileUploadProgress
            uploadType="resource"
            courseId={courseId}
            onUploadComplete={handleUploadComplete}
          />
        </div>
      ) : (
        <button
          onClick={() => setShowUpload(true)}
          className="w-full px-4 py-2 border border-ap-copper text-ap-copper rounded hover:bg-orange-50 font-medium transition"
        >
          + Add Resource
        </button>
      )}

      {/* Resources list */}
      {resources.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No resources yet</div>
      ) : (
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-900 text-sm">Resources</h3>
          {resources.map((resource, index) => (
            <div
              key={resource.id}
              draggable
              onDragStart={() => handleDragStart(resource.id)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-move transition-colors ${
                draggedId === resource.id
                  ? 'border-ap-copper bg-orange-100 opacity-50'
                  : dragOverIndex === index
                  ? 'border-ap-copper bg-orange-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              {/* Drag handle */}
              <div className="text-gray-400 text-lg">⋮⋮</div>

              {/* File icon and info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-2xl flex-shrink-0">
                  {FILE_ICONS[resource.fileType] || FILE_ICONS.other}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{resource.title}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(resource.fileSize)}</p>
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={() => handleDeleteResource(resource.id, resource.title)}
                className="text-red-600 hover:text-red-800 font-medium text-sm flex-shrink-0"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

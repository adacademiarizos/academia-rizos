'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { UploadFeedbackField } from './UploadFeedbackField'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type ResultImage = {
  id: string
  url: string
  label: string | null
  aspectRatio: number
  width: number
  height: number
}

export default function ResultsUploaderLive({ initial }: { initial: ResultImage[] }) {
  const router = useRouter()
  const [images, setImages] = useState<ResultImage[]>(initial)
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function readDimensions(file: File) {
    setError(null)
    setDimensions(null)
    const imageUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      setDimensions({ w: image.naturalWidth, h: image.naturalHeight })
      URL.revokeObjectURL(imageUrl)
    }
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl)
      setError('No pudimos leer las dimensiones de esta imagen.')
    }
    image.src = imageUrl
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    setError(null)
    try {
      const response = await fetch('/api/admin/results/' + id, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result?.error?.message || 'No se pudo eliminar la imagen.')
      setImages((current) => current.filter((image) => image.id !== id))
      router.refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la imagen.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mt-6 space-y-8">
      <div className="max-w-xl rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="mb-4 text-sm font-semibold text-white/70">Agregar imagen de resultado</p>
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Etiqueta (opcional)" className="mb-4 w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/30" />
        <UploadFeedbackField
          label="Imagen de resultado"
          helperText="JPEG, PNG o WebP · máximo 10 MB"
          accept="image/jpeg,image/png,image/webp"
          allowedTypes={ALLOWED_TYPES}
          maxBytes={MAX_BYTES}
          endpoint="/api/admin/results"
          onFileSelected={readDimensions}
          onFileCleared={() => setDimensions(null)}
          createFormData={(file) => {
            if (!dimensions) throw new Error('Todavía estamos leyendo las dimensiones de la imagen.')
            const form = new FormData()
            form.set('file', file)
            form.set('width', String(dimensions.w))
            form.set('height', String(dimensions.h))
            form.set('aspectRatio', String(dimensions.w / dimensions.h))
            if (label.trim()) form.set('label', label.trim())
            return form
          }}
          getResult={(payload) => {
            const result = payload as { ok?: boolean; data?: ResultImage; error?: { message?: string } }
            if (!result.ok || !result.data) throw new Error(result.error?.message || 'No se pudo subir la imagen.')
            return result.data
          }}
          onUploaded={(image) => {
            setImages((current) => [...current, image])
            setLabel('')
            router.refresh()
          }}
        />
        {dimensions ? <p className="mt-3 text-xs text-white/45">{dimensions.w} × {dimensions.h}px · proporción {(dimensions.w / dimensions.h).toFixed(2)}</p> : null}
        {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
      </div>

      {images.length === 0 ? (
        <p className="text-sm text-white/40">Sin imágenes cargadas aún.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((image) => (
            <div key={image.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <img src={image.url} alt={image.label || 'Resultado'} className="aspect-square w-full object-cover" />
              {image.label ? <p className="truncate px-2 py-1.5 text-xs text-white/60">{image.label}</p> : null}
              <button type="button" onClick={() => void handleDelete(image.id)} disabled={deletingId === image.id} className="absolute right-2 top-2 rounded-xl bg-black/60 p-1.5 text-white/40 opacity-0 transition hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100 disabled:opacity-40" aria-label="Eliminar imagen">
                {deletingId === image.id ? <span className="block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

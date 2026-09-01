'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageIcon, X } from 'lucide-react'
import { UploadFeedbackField } from './UploadFeedbackField'

const MAX_IMAGES = 3
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function ServiceImagesUploader({ serviceId, imageUrls: initial }: { serviceId: string; imageUrls: string[] }) {
  const router = useRouter()
  const [imageUrls, setImageUrls] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(url: string) {
    setError(null)
    try {
      const response = await fetch('/api/admin/services/' + serviceId + '/images?url=' + encodeURIComponent(url), { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result?.error?.message || 'No se pudo eliminar la imagen.')
      setImageUrls(result.data.imageUrls)
      router.refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la imagen.')
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
        Imágenes de referencia ({imageUrls.length}/{MAX_IMAGES})
      </p>

      <div className="flex flex-wrap gap-2">
        {imageUrls.map((url) => (
          <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-xl">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => void handleDelete(url)} className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 transition group-hover:opacity-100" aria-label="Eliminar imagen">
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        ))}
        {imageUrls.length === 0 ? <div className="flex items-center gap-2 text-xs text-white/30"><ImageIcon className="h-3.5 w-3.5" />Sin imágenes aún</div> : null}
      </div>

      {imageUrls.length < MAX_IMAGES ? (
        <UploadFeedbackField
          label="Agregar imagen"
          helperText="JPEG, PNG o WebP · máximo 5 MB"
          accept="image/jpeg,image/png,image/webp"
          allowedTypes={ALLOWED_TYPES}
          maxBytes={MAX_BYTES}
          endpoint={'/api/admin/services/' + serviceId + '/images'}
          createFormData={(image) => { const form = new FormData(); form.set('image', image); return form }}
          getResult={(payload) => {
            const result = payload as { ok?: boolean; data?: { imageUrls?: string[] }; error?: { message?: string } }
            if (!result.ok || !result.data?.imageUrls) throw new Error(result.error?.message || 'No se pudo subir la imagen.')
            return result.data.imageUrls
          }}
          onUploaded={(urls) => { setImageUrls(urls); router.refresh() }}
        />
      ) : (
        <p className="text-sm text-white/45">Ya alcanzaste el máximo de imágenes para este servicio.</p>
      )}

      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
    </div>
  )
}

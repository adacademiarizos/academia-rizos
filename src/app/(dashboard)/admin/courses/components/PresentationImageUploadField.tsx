'use client'

import { useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { UploadFeedbackField } from '@/app/components/UploadFeedbackField'

interface PresentationImageUploadFieldProps {
  label: string
  value: string | null
  onChange: (url: string | null) => void
  /** Names the image inside the buttons and the screen-reader labels. */
  itemName?: string
}

export function PresentationImageUploadField({ label, value, onChange, itemName = 'imagen o banner' }: PresentationImageUploadFieldProps) {
  const dialogId = useId()
  const [isReplacing, setIsReplacing] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const showUploader = !value || isReplacing

  return <div className="space-y-3">
    <span className="text-sm font-medium text-white/75">{label}</span>
    {value && !isReplacing ? <div className="space-y-3">
      <button type="button" onClick={() => setIsPreviewOpen(true)} className="group block aspect-video w-full overflow-hidden rounded-2xl border border-white/15 bg-white/5 focus:outline-none focus:ring-2 focus:ring-ap-copper/70" aria-label={`Ver ${itemName} en tamaño grande`}>
        <img src={value} alt={itemName} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setIsReplacing(true)} className="h-10 rounded-xl bg-[#646a40] px-3 text-sm font-medium text-white transition hover:bg-[#747b4b]">Reemplazar</button>
        <button type="button" onClick={() => onChange(null)} className="h-10 rounded-xl border border-red-300/20 bg-red-400/10 px-3 text-sm font-medium text-red-300 transition hover:bg-red-400/20">Eliminar</button>
      </div>
    </div> : null}
    {showUploader ? <div className="space-y-2">
      <UploadFeedbackField
        key={value ?? 'empty'}
        label={value ? `Reemplazar ${itemName}` : `Cargar ${itemName}`}
        helperText="JPG, PNG, WebP o GIF · máximo 5 MB"
        accept="image/jpeg,image/png,image/webp,image/gif"
        allowedTypes={['image/jpeg', 'image/png', 'image/webp', 'image/gif']}
        maxBytes={5 * 1024 * 1024}
        endpoint="/api/admin/uploads/image"
        createFormData={(file) => { const form = new FormData(); form.append('image', file); return form }}
        getResult={(payload) => {
          const result = payload as { ok?: boolean; data?: { url?: string }; error?: { message?: string } }
          if (!result.ok || !result.data?.url) throw new Error(result.error?.message || `No se pudo subir la ${itemName}`)
          return result.data.url
        }}
        onUploaded={(url) => { onChange(url); setIsReplacing(false) }}
      />
      {value ? <button type="button" onClick={() => setIsReplacing(false)} className="text-sm text-white/55 transition hover:text-white/80">Cancelar reemplazo</button> : null}
    </div> : null}
    {/* Portaled to the body: this field sits inside a card that uses
        backdrop-blur, and a backdrop-filter ancestor becomes the containing
        block for fixed children, which would anchor the overlay to the card. */}
    {isPreviewOpen && value ? createPortal(<div id={dialogId} role="dialog" aria-modal="true" aria-label={`Vista previa de la ${itemName}`} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setIsPreviewOpen(false)}>
      <div className="relative flex max-h-[90vh] max-w-5xl items-center justify-center rounded-2xl border border-white/15 bg-[#181716] p-2 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <img src={value} alt={`${itemName} ampliada`} className="max-h-[85vh] max-w-full rounded-xl object-contain" />
        <button type="button" onClick={() => setIsPreviewOpen(false)} aria-label="Cerrar vista previa" className="absolute right-4 top-4 rounded-full bg-black/65 px-3 py-1.5 text-lg text-white/85 transition hover:bg-black/85">×</button>
      </div>
    </div>, document.body) : null}
  </div>
}

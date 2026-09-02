'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

interface OnboardingFormProps {
  initialName: string
  email: string
  initialImage: string | null
  initialPhone: string
  next: string
}

const MAX_IMAGE_BYTES = 3 * 1024 * 1024

export default function OnboardingForm({
  initialName,
  email,
  initialImage,
  initialPhone,
  next,
}: OnboardingFormProps) {
  const router = useRouter()
  const { update } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [imageUrl, setImageUrl] = useState<string | null>(initialImage)
  const [preview, setPreview] = useState<string | null>(initialImage)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handlePickImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (file.size > MAX_IMAGE_BYTES) {
      setError('La imagen no puede superar 3 MB')
      return
    }

    setError('')
    setUploading(true)
    // Show the local file straight away so the picker feels instant; the
    // uploaded URL replaces it once storage answers.
    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/me/avatar', { method: 'POST', body: formData })
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'No se pudo subir la imagen')
      }

      setImageUrl(payload.data.imageUrl)
      setPreview(payload.data.imageUrl)
    } catch (caught) {
      setPreview(imageUrl)
      setError(caught instanceof Error ? caught.message : 'No se pudo subir la imagen')
    } finally {
      URL.revokeObjectURL(localPreview)
      setUploading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (name.trim().length < 2) {
      setError('Escribe tu nombre completo')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null, image: imageUrl }),
      })
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'No se pudo guardar tu perfil')
      }

      // Refresh the session so the new name and picture show up immediately.
      await update()
      router.replace(next)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar tu perfil')
      setSaving(false)
    }
  }

  const busy = saving || uploading
  const initials = (name || email).slice(0, 1).toUpperCase()

  return (
    <div className="min-h-screen bg-[#181716] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Apoteósicas" className="h-12 mx-auto mb-5" />
          <h1 className="text-2xl text-white mb-1" style={{ fontFamily: 'Georgia, serif' }}>
            Completa tu perfil
          </h1>
          <p className="text-sm text-white/40">
            Tu nombre completo es el que aparecerá en tus certificados.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl px-6 py-7">
          {error && (
            <div className="mb-5 rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Profile picture — optional */}
            <div className="flex items-center gap-4">
              {preview ? (
                <img
                  src={preview}
                  alt=""
                  className="h-16 w-16 rounded-full object-cover ring-1 ring-white/15"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-white/5 ring-1 ring-white/15 flex items-center justify-center text-lg font-semibold text-white/50">
                  {initials}
                </div>
              )}

              <div className="flex flex-col items-start gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handlePickImage}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="rounded-2xl bg-white/5 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/10 hover:bg-white/10 transition disabled:opacity-40"
                >
                  {uploading ? 'Subiendo…' : preview ? 'Cambiar foto' : 'Subir foto'}
                </button>
                <span className="text-xs text-white/30">Opcional · máx. 3 MB</span>
              </div>
            </div>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre completo"
              required
              disabled={busy}
              className="h-11 rounded-2xl bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/20 transition disabled:opacity-50"
            />

            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Teléfono (opcional)"
              disabled={busy}
              className="h-11 rounded-2xl bg-white/5 px-4 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/20 transition disabled:opacity-50"
            />

            <p className="text-xs text-white/30">
              Cuenta: <span className="text-white/50">{email}</span>
            </p>

            <button
              type="submit"
              disabled={busy || name.trim().length < 2}
              className="mt-1 h-11 w-full rounded-2xl bg-[#646a40] text-sm font-semibold text-white ring-1 ring-white/10 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {saving ? 'Guardando…' : 'Continuar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

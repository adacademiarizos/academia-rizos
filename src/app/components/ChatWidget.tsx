'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface ChatMessage {
  id: string
  body: string
  imageUrl: string | null
  createdAt: string
  userId: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface ChatWidgetProps {
  courseId: string
}

function Avatar({ user }: { user: { name: string | null; email: string; image: string | null } }) {
  if (user.image) {
    return <img src={user.image} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
  }
  return (
    <div className="w-6 h-6 rounded-full bg-ap-copper/30 border border-ap-copper/40 flex items-center justify-center text-xs font-bold text-ap-copper flex-shrink-0">
      {(user.name || user.email).slice(0, 1).toUpperCase()}
    </div>
  )
}

export function ChatWidget({ courseId }: ChatWidgetProps) {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [noAccess, setNoAccess] = useState(false)
  const [sending, setSending] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`/api/chat/rooms/${courseId}`)
        const data = await res.json()
        if (data.success) {
          setRoomId(data.data.id)
        } else {
          setNoAccess(true)
          setInitialLoading(false)
        }
      } catch {
        setInitialLoading(false)
      }
    }
    init()
  }, [courseId])

  const fetchMessages = useCallback(async () => {
    if (!roomId) return
    try {
      const res = await fetch(`/api/chat/messages?roomId=${roomId}&limit=60&offset=0`)
      const data = await res.json()
      if (data.success) setMessages(data.data.messages)
    } catch {
      // ignore
    } finally {
      setInitialLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    if (!roomId || !isOpen) return
    fetchMessages()
    const interval = setInterval(fetchMessages, 3000)
    return () => clearInterval(interval)
  }, [roomId, isOpen, fetchMessages])

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { setError('Máx. 3 MB'); return }
    setPendingImage(file)
    setPendingPreview(URL.createObjectURL(file))
    setError(null)
  }

  const removePending = () => {
    setPendingImage(null)
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    setPendingPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user || !roomId) return
    if (!text.trim() && !pendingImage) return
    setSending(true)
    setError(null)

    try {
      let imageUrl: string | undefined
      if (pendingImage) {
        const fd = new FormData()
        fd.append('file', pendingImage)
        const r = await fetch('/api/chat/images', { method: 'POST', body: fd })
        const d = await r.json()
        if (!r.ok) { setError(d.error || 'Error al subir imagen'); setSending(false); return }
        imageUrl = d.data.imageUrl
      }

      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, body: text.trim(), imageUrl }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages((prev) => [...prev, data.data])
        setText('')
        removePending()
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      } else {
        setError(data.error || 'Error al enviar')
      }
    } catch {
      setError('Error al enviar')
    } finally {
      setSending(false)
    }
  }

  // Don't render if user has no access to this course's chat
  if (noAccess) return null

  // Closed state — floating button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-ap-copper hover:bg-orange-700 text-white rounded-2xl p-3.5 shadow-xl z-40 transition"
        aria-label="Abrir chat del curso"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    )
  }

  // Open state — chat window
  return (
    <div className="fixed bottom-6 right-6 w-80 h-[460px] flex flex-col rounded-2xl border border-zinc-700 bg-ap-ink shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-700 bg-ap-ink/95 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-semibold text-ap-ivory">Chat del Curso</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-zinc-400 hover:text-ap-ivory transition text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {initialLoading ? (
          <p className="text-xs text-zinc-500 text-center pt-4">Cargando...</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center pt-4">Nadie ha escrito aún. ¡Sé el primero!</p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.userId === (session?.user as any)?.id
            return (
              <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                <Avatar user={msg.user} />
                <div className={`max-w-[80%] space-y-1 flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-baseline gap-1.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[10px] font-medium text-zinc-400">
                      {msg.user.name || msg.user.email.split('@')[0]}
                    </span>
                    <time className="text-[10px] text-zinc-600">
                      {new Date(msg.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </div>
                  {msg.imageUrl && (
                    <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img src={msg.imageUrl} alt="" className="rounded-xl max-w-full max-h-40 object-contain border border-zinc-700" />
                    </a>
                  )}
                  {msg.body && (
                    <div className={`px-2.5 py-1.5 rounded-2xl text-xs leading-relaxed break-words ${
                      isOwn ? 'bg-ap-copper text-white rounded-tr-sm' : 'bg-white/10 text-ap-ivory rounded-tl-sm'
                    }`}>
                      {msg.body}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {session?.user ? (
        <div className="border-t border-zinc-700 p-2.5 bg-ap-ink/95">
          {pendingPreview && (
            <div className="mb-2 relative inline-block">
              <img src={pendingPreview} alt="" className="h-14 w-auto rounded-lg border border-zinc-600" />
              <button onClick={removePending} className="absolute -top-1 -right-1 w-4 h-4 bg-zinc-800 border border-zinc-600 rounded-full text-[10px] text-zinc-300 flex items-center justify-center">✕</button>
            </div>
          )}
          {error && <p className="text-[10px] text-red-400 mb-1.5">{error}</p>}
          <form onSubmit={handleSend} className="flex items-center gap-1.5">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleImageSelect} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!!pendingImage}
              className="w-8 h-8 rounded-xl bg-white/10 text-zinc-400 hover:text-ap-copper hover:bg-white/15 transition flex items-center justify-center text-sm disabled:opacity-40">
              📎
            </button>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(e as any) }}
              placeholder="Escribe aquí..."
              className="flex-1 bg-white/10 border border-zinc-700 text-ap-ivory placeholder:text-zinc-500 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-ap-copper/50 transition"
            />
            <button type="submit" disabled={sending || (!text.trim() && !pendingImage)}
              className="w-8 h-8 rounded-xl bg-ap-copper hover:bg-orange-700 text-white transition flex items-center justify-center disabled:opacity-40">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        </div>
      ) : (
        <div className="border-t border-zinc-700 p-3 bg-ap-ink/95 text-center">
          <p className="text-xs text-zinc-400">Inicia sesión para chatear</p>
        </div>
      )}
    </div>
  )
}

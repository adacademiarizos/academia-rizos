'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { CommunityText } from '@/app/components/CommunityText'
import { useChatRoom, type ChatMessage } from '@/app/components/useChatRoom'

interface ChatPanelProps {
  roomId: string
  title?: string
}

function Avatar({ user }: { user: { name: string | null; email: string; image: string | null } }) {
  if (user.image) {
    return (
      <img
        src={user.image}
        alt={user.name || user.email}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      />
    )
  }
  const initials = (user.name || user.email).slice(0, 2).toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-ap-copper/30 border border-ap-copper/40 flex items-center justify-center text-xs font-bold text-ap-copper flex-shrink-0">
      {initials}
    </div>
  )
}

export function ChatPanel({ roomId, title }: ChatPanelProps) {
  const { data: session } = useSession()
  const {
    messages,
    text,
    setText,
    pendingImage,
    pendingPreview,
    selectImage,
    removePending,
    appendMention,
    send,
    sending,
    initialLoading,
    error,
    messagesEndRef,
    fileInputRef,
  } = useChatRoom(roomId)

  const isAtBottomRef = useRef(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback((force = false) => {
    if (force || isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messagesEndRef])

  // Scroll to bottom on initial load and new messages
  useEffect(() => {
    scrollToBottom(initialLoading)
  }, [messages, initialLoading, scrollToBottom])

  useEffect(() => {
    const messageId = window.location.hash.replace(/^#message-/, '')
    if (!messageId) return

    document.getElementById(`message-${messageId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }, [messages])

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    isAtBottomRef.current = atBottom
  }

  const handleSend = async (e: React.FormEvent) => {
    if (!session?.user) {
      e.preventDefault()
      return
    }
    await send(e)
    isAtBottomRef.current = true
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend(e as any)
    }
  }

  return (
    <div className="flex flex-col h-full bg-ap-ink/50">
      {/* Header */}
      {title && (
        <div className="px-4 py-3 border-b border-zinc-700 bg-ap-ink/80">
          <h3 className="font-semibold text-ap-ivory text-sm">{title}</h3>
        </div>
      )}

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0"
      >
        {initialLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-zinc-500 text-sm">Cargando mensajes...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-3xl mb-2">💬</div>
              <p className="text-zinc-500 text-sm">Sé el primero en escribir</p>
            </div>
          </div>
        ) : (
          messages.map((msg: ChatMessage) => {
            const isOwn = msg.userId === (session?.user as any)?.id
            return (
              <div id={`message-${msg.id}`} key={msg.id} className={`scroll-mt-24 flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                <Avatar user={msg.user} />
                <div className={`max-w-[75%] space-y-1 ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`flex items-baseline gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs font-medium text-zinc-400">
                      {msg.user.name || msg.user.email.split('@')[0]}
                    </span>
                    <time className="text-xs text-zinc-600">
                      {new Date(msg.createdAt).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>

                  {msg.imageUrl && (
                    <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={msg.imageUrl}
                        alt="Imagen"
                        className="rounded-xl max-w-full max-h-56 object-contain border border-zinc-700 hover:border-ap-copper/50 transition cursor-pointer"
                      />
                    </a>
                  )}

                  {msg.body && (
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                        isOwn
                          ? 'bg-ap-copper text-white rounded-tr-sm'
                          : 'bg-white/10 text-ap-ivory rounded-tl-sm'
                      }`}
                    >
                      <CommunityText body={msg.body} />
                    </div>
                  )}
                  {!isOwn && session?.user && (
                    <button
                      type="button"
                      onClick={() => appendMention(msg.user)}
                      className="text-xs text-ap-copper hover:text-orange-400 transition"
                    >
                      Mencionar
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {session?.user ? (
        <div className="border-t border-zinc-700 p-3 bg-ap-ink/80">
          {/* Image preview */}
          {pendingPreview && (
            <div className="mb-2 relative inline-block">
              <img
                src={pendingPreview}
                alt="Vista previa"
                className="h-20 w-auto rounded-xl border border-zinc-600 object-contain"
              />
              <button
                onClick={removePending}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-800 border border-zinc-600 rounded-full text-xs text-zinc-300 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

          <form onSubmit={handleSend} className="flex items-end gap-2">
            {/* Image upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={selectImage}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!!pendingImage || sending}
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/10 text-zinc-400 hover:text-ap-copper hover:bg-white/15 transition flex items-center justify-center disabled:opacity-50"
              title="Adjuntar imagen (máx. 3 MB)"
            >
              📎
            </button>

            {/* Text input */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje... (Enter para enviar)"
              rows={1}
              className="flex-1 bg-white/10 border border-zinc-700 text-ap-ivory placeholder:text-zinc-500 rounded-xl px-3 py-2 text-sm outline-none focus:border-ap-copper/50 transition resize-none min-h-[36px] max-h-28"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />

            {/* Send button */}
            <button
              type="submit"
              disabled={sending || (!text.trim() && !pendingImage)}
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-ap-copper hover:bg-orange-700 text-white transition flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? (
                <span className="text-xs">···</span>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </button>
          </form>
        </div>
      ) : (
        <div className="border-t border-zinc-700 p-4 bg-ap-ink/80 text-center">
          <p className="text-sm text-zinc-400">Inicia sesión para participar en el chat</p>
        </div>
      )}
    </div>
  )
}

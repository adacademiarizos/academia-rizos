'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { ChatPanel } from '@/app/components/ChatPanel'

export default function CommunityPage() {
  const { status } = useSession()
  const [roomId, setRoomId] = useState<string | null>(null)
  const [loadingRoom, setLoadingRoom] = useState(true)

  useEffect(() => {
    if (status === 'loading') return

    const init = async () => {
      try {
        const res = await fetch('/api/chat/rooms/community')
        const data = await res.json()
        if (data.success) setRoomId(data.data.id)
      } catch {
        // ignore
      } finally {
        setLoadingRoom(false)
      }
    }

    init()
  }, [status])

  return (
    // Escape DashboardShell's horizontal and bottom padding so the chat runs edge-to-edge.
    // Height fills the exact available space inside the shell's main element.
    // Mobile: main has pt-16(64) + pb-6(24) = 88px total vertical padding
    // Desktop: main has md:pt-6(24) + md:pb-8(32) = 56px total vertical padding
    <div className="-mx-5 -mb-6 md:-mx-8 md:-mb-8 flex flex-col h-[calc(100vh-88px)] md:h-[calc(100vh-56px)]">
      {/* Page header */}
      <div className="px-5 py-4 md:px-8 border-b border-zinc-800 flex-shrink-0">
        <h1 className="text-xl font-bold text-white">Chat de la Comunidad</h1>
        <p className="text-sm text-white/50 mt-0.5">Conversa con todos los miembros</p>
      </div>

      {/* Chat area */}
      <div className="flex-1 min-h-0">
        {loadingRoom ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-500 text-sm">Conectando al chat...</p>
          </div>
        ) : roomId ? (
          <ChatPanel roomId={roomId} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-500 text-sm">No se pudo cargar el chat</p>
          </div>
        )}
      </div>
    </div>
  )
}

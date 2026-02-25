'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?limit=5')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.data || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }

  const startPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    pollIntervalRef.current = setInterval(fetchNotifications, 5000)
  }

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }

  const connectSSE = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = new EventSource('/api/notifications/stream')
    eventSourceRef.current = es

    es.addEventListener('notifications', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
        setIsLoading(false)
      } catch {
        // ignore parse errors
      }
    })

    es.onerror = () => {
      // SSE failed — fall back to polling
      es.close()
      eventSourceRef.current = null
      startPolling()
    }

    // Stop polling while SSE is active
    stopPolling()
  }

  useEffect(() => {
    fetchNotifications()

    // Try SSE first, poll as fallback
    connectSSE()

    // Refresh immediately when tab becomes visible
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      eventSourceRef.current?.close()
      stopPolling()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' })
      fetchNotifications()
    } catch {
      // ignore
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', { method: 'POST' })
      fetchNotifications()
    } catch {
      // ignore
    }
  }

  const typeIcon: Record<string, string> = {
    APPOINTMENT: '📅',
    CERTIFICATE: '🎓',
    EXAM_REVIEW: '📝',
    PAYMENT: '💳',
    COMMENT: '💬',
    LIKE: '❤️',
    COURSE_COMPLETION: '✅',
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-white/60 hover:text-white transition-colors"
        aria-label="Notificaciones"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center px-1 text-[10px] font-bold text-white bg-[#B16E34] rounded-full leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-white/10 bg-[#1F1C19] shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <span className="text-sm font-semibold text-[#FAF4EA]">Notificaciones</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-[#B16E34] hover:text-[#c8813f] transition-colors"
              >
                Marcar todo como leído
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-white/5">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-white/40">Cargando...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-white/40">
                Sin notificaciones
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5 ${
                    !n.isRead ? 'bg-[#B16E34]/10' : ''
                  }`}
                  onClick={() => !n.isRead && handleMarkAsRead(n.id)}
                >
                  <span className="text-base leading-none mt-0.5 shrink-0">
                    {typeIcon[n.type] ?? '🔔'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#FAF4EA] truncate">{n.title}</p>
                    <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-white/30 mt-1">
                      {new Date(n.createdAt).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {!n.isRead && (
                    <div className="w-2 h-2 rounded-full bg-[#B16E34] shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-white/8">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-medium text-[#B16E34] hover:text-[#c8813f] transition-colors"
            >
              Ver todas las notificaciones →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

function getIcon(type: string) {
  switch (type) {
    case 'COMMENT': return '💬'
    case 'LIKE': return '❤️'
    case 'COURSE_COMPLETION': return '🏆'
    case 'NEW_COURSE': return '📖'
    case 'PAYMENT': return '✅'
    default: return '📌'
  }
}

export function NotificationsList() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  const LIMIT = 20

  useEffect(() => {
    fetchNotifications()
  }, [filter, page])

  const fetchNotifications = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      params.set('limit', String(LIMIT))
      params.set('offset', String(page * LIMIT))

      if (filter !== 'all') {
        params.set('isRead', filter === 'read' ? 'true' : 'false')
      }

      const response = await fetch(`/api/notifications?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.data || [])
        setTotal(data.total || 0)
      } else {
        setError('Error al cargar las notificaciones')
      }
    } catch (err) {
      console.error('Error fetching notifications:', err)
      setError('Error al cargar las notificaciones')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' })
      fetchNotifications()
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', { method: 'POST' })
      fetchNotifications()
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Notificaciones</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-white/50 mt-0.5">{unreadCount} sin leer</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-sm bg-ap-copper hover:bg-orange-700 text-white px-4 py-2 rounded-xl transition font-medium"
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['all', 'unread', 'read'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(0) }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filter === f
                ? 'bg-ap-copper text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/15 hover:text-white/90'
            }`}
          >
            {f === 'all' ? 'Todas' : f === 'unread' ? 'No leídas' : 'Leídas'}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-16 text-white/40">Cargando notificaciones...</div>
      ) : error ? (
        <div className="text-center py-16 text-red-400">{error}</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="text-4xl">🔔</div>
          <p className="text-white/40">
            {filter === 'unread'
              ? 'No tienes notificaciones sin leer'
              : filter === 'read'
              ? 'No tienes notificaciones leídas'
              : 'No tienes notificaciones aún'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 rounded-2xl border transition ${
                notification.isRead
                  ? 'bg-white/5 border-zinc-800'
                  : 'bg-ap-copper/10 border-ap-copper/30'
              }`}
            >
              <div className="flex items-start gap-4">
                {!notification.isRead && (
                  <span className="mt-2 w-2 h-2 rounded-full bg-ap-copper flex-shrink-0" />
                )}
                <span className="text-xl flex-shrink-0">{getIcon(notification.type)}</span>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold text-sm ${notification.isRead ? 'text-white/70' : 'text-white'}`}>
                    {notification.title}
                  </h3>
                  <p className="text-white/50 text-sm mt-0.5">{notification.message}</p>
                  <p className="text-xs text-white/30 mt-1.5">
                    {new Date(notification.createdAt).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                {!notification.isRead && (
                  <button
                    onClick={() => handleMarkAsRead(notification.id)}
                    className="text-xs text-ap-copper hover:text-orange-400 whitespace-nowrap mt-1 transition flex-shrink-0"
                  >
                    Marcar como leída
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > LIMIT && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-2 bg-white/10 text-white/60 rounded-xl text-sm disabled:opacity-30 hover:bg-white/15 transition"
          >
            Anterior
          </button>
          <span className="text-sm text-white/40">
            Página {page + 1} de {Math.ceil(total / LIMIT)}
          </span>
          <button
            onClick={() => setPage(Math.min(Math.ceil(total / LIMIT) - 1, page + 1))}
            disabled={page >= Math.ceil(total / LIMIT) - 1}
            className="px-4 py-2 bg-white/10 text-white/60 rounded-xl text-sm disabled:opacity-30 hover:bg-white/15 transition"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}

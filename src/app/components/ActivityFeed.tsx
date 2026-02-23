'use client'

import { useEffect, useState } from 'react'

interface Activity {
  id: string
  type: string
  courseId?: string
  moduleId?: string
  metadata?: Record<string, any>
  createdAt: string
}

interface ActivityFeedProps {
  userId?: string // If provided, shows public view; if not, shows own activity
  limit?: number
}

export function ActivityFeed({ userId, limit = 10 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchActivities()
  }, [userId])

  const fetchActivities = async () => {
    try {
      setIsLoading(true)
      const endpoint = userId
        ? `/api/users/${userId}/activity?limit=${limit}`
        : `/api/me/activity?limit=${limit}`

      const response = await fetch(endpoint)
      if (response.ok) {
        const result = await response.json()
        setActivities(result.data || [])
      } else {
        setError('Error loading activities')
      }
    } catch (err) {
      console.error('Error fetching activities:', err)
      setError('Error loading activities')
    } finally {
      setIsLoading(false)
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'COURSE_STARTED':
        return '📖'
      case 'MODULE_COMPLETED':
        return '✅'
      case 'TEST_PASSED':
        return '🏆'
      case 'COMMENT_POSTED':
        return '💬'
      case 'LIKE':
        return '❤️'
      default:
        return '📌'
    }
  }

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'COURSE_STARTED':
        return 'Inició un curso'
      case 'MODULE_COMPLETED':
        return 'Completó un módulo'
      case 'TEST_PASSED':
        return 'Aprobó un test'
      case 'COMMENT_POSTED':
        return 'Hizo un comentario'
      case 'LIKE':
        return 'Dio like a contenido'
      default:
        return 'Actividad'
    }
  }

  if (isLoading) {
    return <div className="text-center py-6 text-gray-500">Cargando actividades...</div>
  }

  if (error) {
    return <div className="text-center py-6 text-red-600">{error}</div>
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        No hay actividades todavía
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
        >
          <span className="text-xl mt-1">{getActivityIcon(activity.type)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              {getActivityLabel(activity.type)}
            </p>
            {activity.metadata?.courseName && (
              <p className="text-sm text-gray-600 truncate">
                En: {activity.metadata.courseName}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {new Date(activity.createdAt).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

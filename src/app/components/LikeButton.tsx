'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface LikeButtonProps {
  targetType: 'COURSE' | 'MODULE'
  courseId?: string
  moduleId?: string
}

export function LikeButton({ targetType, courseId, moduleId }: LikeButtonProps) {
  const { data: session } = useSession()
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch initial like count and user's like status
  useEffect(() => {
    const fetchLikes = async () => {
      try {
        // Get like count
        const ids = targetType === 'COURSE' ? `courseIds=${courseId}` : `moduleIds=${moduleId}`
        const countRes = await fetch(`/api/likes/count?${ids}`)
        const countData = await countRes.json()
        if (countData.success && countData.data) {
          const key = targetType === 'COURSE' ? courseId : moduleId
          if (key) {
            setLikeCount(countData.data[key] || 0)
          }
        }

        // Get user's likes if logged in
        if (session?.user) {
          const userRes = await fetch('/api/likes/my-likes')
          const userData = await userRes.json()
          if (userData.success) {
            const isUserLiked =
              targetType === 'COURSE'
                ? userData.data.courseIds.includes(courseId)
                : userData.data.moduleIds.includes(moduleId)
            setIsLiked(isUserLiked)
          }
        }
      } catch (err) {
        console.error('Error fetching likes:', err)
      }
    }

    fetchLikes()
  }, [targetType, courseId, moduleId, session])

  const handleToggleLike = async () => {
    if (!session?.user) {
      setError('Please sign in to like courses')
      setTimeout(() => setError(null), 3000)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          courseId: targetType === 'COURSE' ? courseId : undefined,
          moduleId: targetType === 'MODULE' ? moduleId : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to toggle like')
      }

      // Toggle like state and update count
      setIsLiked(data.data.liked)
      setLikeCount((prev) => (data.data.liked ? prev + 1 : prev - 1))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle like')
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggleLike}
        disabled={isLoading}
        className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
          isLiked
            ? 'bg-red-100 text-red-600 hover:bg-red-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className="text-lg">{isLiked ? '❤️' : '🤍'}</span>
        <span className="text-sm font-medium">{likeCount}</span>
      </button>
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  )
}

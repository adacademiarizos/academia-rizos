'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface Comment {
  id: string
  body: string
  createdAt: string
  userId: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface CommentsSectionProps {
  targetType: 'COURSE' | 'MODULE'
  courseId?: string
  moduleId?: string
}

export function CommentsSection({ targetType, courseId, moduleId }: CommentsSectionProps) {
  const { data: session } = useSession()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limit] = useState(20)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      try {
        setIsFetching(true)
        const params = new URLSearchParams({
          targetType,
          limit: String(limit),
          offset: String(offset),
          ...(courseId && { courseId }),
          ...(moduleId && { moduleId }),
        })

        const res = await fetch(`/api/comments?${params}`)
        const data = await res.json()

        if (data.success) {
          setComments(data.data.comments)
          setTotal(data.data.total)
        } else {
          setError('Failed to load comments')
        }
      } catch (err) {
        console.error('Error fetching comments:', err)
        setError('Error loading comments')
      } finally {
        setIsFetching(false)
      }
    }

    fetchComments()
  }, [targetType, courseId, moduleId, offset, limit])

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!session?.user) {
      setError('Please sign in to comment')
      return
    }

    if (!newComment.trim()) {
      setError('Comment cannot be empty')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          body: newComment,
          ...(courseId && { courseId }),
          ...(moduleId && { moduleId }),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to post comment')
      }

      // Add comment to list
      setComments([data.data, ...comments])
      setNewComment('')
      setTotal(total + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return

    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      if (res.ok) {
        setComments(comments.filter((c) => c.id !== commentId))
        setTotal(total - 1)
      } else {
        setError('Failed to delete comment')
      }
    } catch (err) {
      console.error('Error deleting comment:', err)
      setError('Error deleting comment')
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Comentarios ({total})</h3>

      {session?.user && (
        <form onSubmit={handleSubmitComment} className="space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Escribe un comentario..."
            className="w-full p-3 border rounded-lg resize-none"
            rows={3}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Publicando...' : 'Publicar comentario'}
          </button>
        </form>
      )}

      {!session?.user && (
        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
          Inicia sesión para comentar
        </p>
      )}

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

      {isFetching && <div className="text-sm text-gray-500">Cargando comentarios...</div>}

      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-start mb-1">
              <strong className="text-sm">{comment.user.name || comment.user.email}</strong>
              <time className="text-xs text-gray-500">
                {new Date(comment.createdAt).toLocaleDateString('es-ES')}
              </time>
            </div>
            <p className="text-sm text-gray-700">{comment.body}</p>
            {session?.user?.email === comment.user.email && (
              <button
                onClick={() => handleDeleteComment(comment.id)}
                className="mt-2 text-xs text-red-600 hover:text-red-800"
              >
                Eliminar
              </button>
            )}
          </div>
        ))}
      </div>

      {comments.length < total && (
        <button
          onClick={() => setOffset(offset + limit)}
          className="w-full text-sm text-blue-600 hover:text-blue-800 py-2"
        >
          Cargar más comentarios
        </button>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { CommunityText } from '@/app/components/CommunityText'
import { createCommunityMentionToken } from '@/lib/community-mentions'

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
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  // Comment data is loaded client-side, so resolve a notification hash after
  // the target element exists rather than relying on the browser's initial
  // anchor jump.
  useEffect(() => {
    const commentId = window.location.hash.replace(/^#comment-/, '')
    if (!commentId) return

    document.getElementById(`comment-${commentId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }, [comments])

  const appendMention = (user: Comment['user']) => {
    const token = createCommunityMentionToken(user)

    setNewComment((current) => {
      if (current.includes(`](${user.id})`)) return current
      return `${current}${current.trimEnd() ? ' ' : ''}${token} `
    })
    textareaRef.current?.focus()
  }

  const beginReply = (comment: Comment) => {
    setReplyTarget(comment)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

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
          ...(replyTarget && { replyToCommentId: replyTarget.id }),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to post comment')
      }

      // Add comment to list
      setComments([data.data, ...comments])
      setNewComment('')
      setReplyTarget(null)
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
          {replyTarget && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-ap-copper/30 bg-ap-copper/10 px-3 py-2 text-xs text-gray-700">
              <span>
                Respondiendo a <strong>{replyTarget.user.name || replyTarget.user.email}</strong>
              </span>
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                className="font-medium text-ap-copper hover:text-orange-700"
              >
                Cancelar
              </button>
            </div>
          )}
          <textarea
            ref={textareaRef}
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
          <p className="text-xs text-gray-500">
            Usa <strong>Mencionar</strong> para avisar directamente a otro participante.
          </p>
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
        {comments.map((comment) => {
          const isOwnComment = session?.user?.email === comment.user.email

          return (
          <div id={`comment-${comment.id}`} key={comment.id} className="scroll-mt-24 p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-start mb-1">
              <strong className="text-sm">{comment.user.name || comment.user.email}</strong>
              <time className="text-xs text-gray-500">
                {new Date(comment.createdAt).toLocaleDateString('es-ES')}
              </time>
            </div>
            <p className="text-sm text-gray-700"><CommunityText body={comment.body} /></p>
            {!isOwnComment && session?.user && (
              <div className="mt-2 flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => beginReply(comment)}
                  className="text-ap-copper hover:text-orange-700"
                >
                  Responder
                </button>
                <button
                  type="button"
                  onClick={() => appendMention(comment.user)}
                  className="text-ap-copper hover:text-orange-700"
                >
                  Mencionar
                </button>
              </div>
            )}
            {isOwnComment && (
              <button
                onClick={() => handleDeleteComment(comment.id)}
                className="mt-2 text-xs text-red-600 hover:text-red-800"
              >
                Eliminar
              </button>
            )}
          </div>
          )
        })}
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

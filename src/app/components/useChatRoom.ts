'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createCommunityMentionToken } from '@/lib/community-mentions'

export interface ChatMessage {
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

/**
 * Shared data layer for course chat surfaces (ChatWidget floating bubble and
 * the full-page ChatPanel). Handles message polling, sending, image upload
 * and mention insertion. Presentation (layout, scroll anchoring) stays with
 * each consuming component.
 */
export function useChatRoom(roomId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchMessages = useCallback(async () => {
    if (!roomId) return
    try {
      const res = await fetch(`/api/chat/messages?roomId=${roomId}&limit=80&offset=0`)
      const data = await res.json()
      if (data.success) setMessages(data.data.messages)
    } catch {
      // silent — polling handles retries
    } finally {
      setInitialLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    fetchMessages()
    const interval = setInterval(fetchMessages, 3000)
    return () => clearInterval(interval)
  }, [roomId, fetchMessages])

  const selectImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      setError('La imagen no puede superar 3 MB')
      return
    }
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

  const appendMention = (user: ChatMessage['user']) => {
    const token = createCommunityMentionToken(user)

    setText((current) => {
      if (current.includes(`](${user.id})`)) return current
      return `${current}${current.trimEnd() ? ' ' : ''}${token} `
    })
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomId) return
    if (!text.trim() && !pendingImage) return

    setSending(true)
    setError(null)

    try {
      let imageUrl: string | undefined

      if (pendingImage) {
        const fd = new FormData()
        fd.append('file', pendingImage)
        const uploadRes = await fetch('/api/chat/images', { method: 'POST', body: fd })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) {
          setError(uploadData.error || 'Error al subir la imagen')
          setSending(false)
          return
        }
        imageUrl = uploadData.data.imageUrl
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
        setError(data.error || 'Error al enviar el mensaje')
      }
    } catch {
      setError('Error al enviar el mensaje')
    } finally {
      setSending(false)
    }
  }

  return {
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
  }
}

/**
 * Resolves the chat room id for a given course, absorbing the
 * roomId-from-courseId lookup previously inlined in ChatWidget.
 */
export function useCourseChatRoom(courseId: string) {
  const [roomId, setRoomId] = useState<string | null>(null)
  const [noAccess, setNoAccess] = useState(false)

  useEffect(() => {
    let active = true
    const init = async () => {
      try {
        const res = await fetch(`/api/chat/rooms/${courseId}`)
        const data = await res.json()
        if (!active) return
        if (data.success) {
          setRoomId(data.data.id)
        } else {
          setNoAccess(true)
        }
      } catch {
        // ignore — noAccess stays false, roomId stays null
      }
    }
    init()
    return () => {
      active = false
    }
  }, [courseId])

  return { roomId, noAccess }
}

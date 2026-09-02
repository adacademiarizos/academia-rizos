'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChatPanel } from '@/app/components/ChatPanel'

export default function CourseChatPage() {
  const params = useParams()
  const courseId = params.courseId as string

  const [roomId, setRoomId] = useState<string | null>(null)
  const [courseName, setCourseName] = useState<string>('')
  const [loadingRoom, setLoadingRoom] = useState(true)
  const [noAccess, setNoAccess] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        // Fetch course name and room in parallel
        const [roomRes, courseRes] = await Promise.all([
          fetch(`/api/chat/rooms/${courseId}`),
          fetch(`/api/courses/${courseId}`),
        ])

        const roomData = await roomRes.json()
        if (roomData.success) {
          setRoomId(roomData.data.id)
        } else {
          setNoAccess(true)
        }

        if (courseRes.ok) {
          const courseData = await courseRes.json()
          setCourseName(courseData.data?.title || '')
        }
      } catch {
        setNoAccess(true)
      } finally {
        setLoadingRoom(false)
      }
    }

    init()
  }, [courseId])

  return (
    <div className="flex flex-col h-screen bg-ap-ink">
      {/* Breadcrumb / back bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-ap-ink flex-shrink-0">
        <Link
          href={`/learn/${courseId}`}
          className="text-zinc-400 hover:text-ap-copper transition text-sm"
        >
          ← {courseName || 'Volver al curso'}
        </Link>
        <h1 className="text-sm font-semibold text-ap-ivory">Chat del Curso</h1>
        <div className="w-24" />
      </div>

      {/* Chat area — fills remaining height */}
      <div className="flex-1 min-h-0">
        {loadingRoom ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-500 text-sm">Conectando al chat...</p>
          </div>
        ) : noAccess ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
            <div className="text-4xl">🔒</div>
            <p className="text-zinc-400 text-sm max-w-xs">
              Necesitas acceso a este curso para participar en el chat.
            </p>
            <Link
              href="/courses"
              className="px-4 py-2 rounded-xl bg-ap-copper hover:bg-orange-700 text-white text-sm font-medium transition"
            >
              Ver cursos
            </Link>
          </div>
        ) : roomId ? (
          <ChatPanel roomId={roomId} />
        ) : null}
      </div>
    </div>
  )
}

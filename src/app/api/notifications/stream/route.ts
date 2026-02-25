import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const userId = user.id

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      function send(event: string, data: unknown) {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          // Client disconnected
        }
      }

      // Send initial notification count immediately
      const sendUpdate = async () => {
        try {
          const unreadCount = await db.notification.count({
            where: { userId, isRead: false },
          })
          const latest = await db.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
          send('notifications', { unreadCount, notifications: latest })
        } catch {
          // DB error — skip this tick
        }
      }

      await sendUpdate()

      // Poll DB every 5 seconds and push updates
      const interval = setInterval(sendUpdate, 5000)

      // Keep-alive ping every 20 seconds
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          clearInterval(interval)
          clearInterval(keepAlive)
        }
      }, 20000)

      // Clean up when client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        clearInterval(keepAlive)
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

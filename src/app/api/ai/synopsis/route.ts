/**
 * POST /api/ai/synopsis
 * Generate a short description/synopsis for a lesson using its transcript.
 * Returns the generated text — does NOT save it automatically.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { getOpenAI } from '@/lib/openai'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    })
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { lessonId } = body as { lessonId?: string }

    if (!lessonId) {
      return NextResponse.json({ success: false, error: 'lessonId is required' }, { status: 400 })
    }

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      select: { title: true, transcript: true },
    })

    if (!lesson) {
      return NextResponse.json({ success: false, error: 'Lesson not found' }, { status: 404 })
    }

    if (!lesson.transcript) {
      return NextResponse.json(
        { success: false, error: 'La lección no tiene transcripción. Transcribí el video primero.' },
        { status: 400 }
      )
    }

    const openai = getOpenAI()

    const MAX_TRANSCRIPT_CHARS = 6000
    const transcript =
      lesson.transcript.length > MAX_TRANSCRIPT_CHARS
        ? lesson.transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '...'
        : lesson.transcript

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content:
            'Eres un asistente que genera descripciones breves y atractivas para lecciones de cursos en línea. ' +
            'Escribe en español. Responde SOLO con la descripción, sin saludos ni explicaciones adicionales. ' +
            'La descripción debe tener entre 2 y 3 oraciones, explicando qué aprenderá el alumno en esta lección.',
        },
        {
          role: 'user',
          content: `Lección: "${lesson.title}"\n\nTranscripción:\n${transcript}\n\nGenera una descripción breve de esta lección.`,
        },
      ],
    })

    const synopsis = completion.choices[0]?.message?.content?.trim() ?? ''

    return NextResponse.json({ success: true, data: { synopsis } })
  } catch (error) {
    console.error('Synopsis generation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate synopsis',
      },
      { status: 500 }
    )
  }
}

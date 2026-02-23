import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { getOpenAI } from '@/lib/openai'

const TRANSCRIPT_MAX_CHARS = 8000

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return ''
  if (text.length <= max) return text
  return text.slice(0, max) + '...[texto truncado]'
}

function buildCourseContext(
  course: {
    title: string
    description: string | null
    modules: Array<{
      order: number
      title: string
      description: string | null
      transcript: string | null
      id: string
      lessons: Array<{
        order: number
        title: string
        description: string | null
        transcript: string | null
      }>
    }>
  },
  focusModuleId?: string
): string {
  const lines: string[] = []
  lines.push(`CURSO: ${course.title}`)
  if (course.description) lines.push(`Descripción: ${course.description}`)
  lines.push('')

  const modulesToInclude = focusModuleId
    ? course.modules.filter(m => m.id === focusModuleId)
    : course.modules

  for (const mod of modulesToInclude) {
    lines.push(`--- MÓDULO ${mod.order}: ${mod.title} ---`)
    if (mod.description) lines.push(`Descripción: ${mod.description}`)
    const modTranscript = truncate(mod.transcript, TRANSCRIPT_MAX_CHARS)
    if (modTranscript) {
      lines.push('Transcripción del módulo:')
      lines.push(modTranscript)
    }

    for (const lesson of mod.lessons) {
      lines.push(`  [Lección ${lesson.order + 1}: ${lesson.title}]`)
      if (lesson.description) lines.push(`  Descripción: ${lesson.description}`)
      const lessonTranscript = truncate(lesson.transcript, TRANSCRIPT_MAX_CHARS)
      if (lessonTranscript) {
        lines.push('  Transcripción de la lección:')
        lines.push(`  ${lessonTranscript}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

function buildSystemPrompt(courseTitle: string, courseContext: string): string {
  return `Eres un asistente de aprendizaje especializado en el curso "${courseTitle}".
Tu misión es ayudar a los estudiantes a comprender el contenido del curso, responder preguntas sobre los temas enseñados y apoyar su proceso de aprendizaje.

INSTRUCCIONES:
- Responde SIEMPRE en español
- Basa tus respuestas principalmente en el CONTEXTO DEL CURSO que se te proporciona
- Si la pregunta no está relacionada con el contenido del curso, indícalo amablemente y redirige al tema del curso
- Si no tienes información suficiente en el contexto, dilo claramente en lugar de inventar
- Sé conciso (máximo 3-4 párrafos), claro y didáctico
- Usa un tono amigable, motivador y profesional

CONTEXTO DEL CURSO:
${courseContext}`
}

export async function POST(request: NextRequest) {
  try {
    // Auth
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    })
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 401 })
    }

    const body = await request.json()
    const { courseId, moduleId, messages } = body as {
      courseId: string
      moduleId?: string
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    if (!courseId || !Array.isArray(messages)) {
      return NextResponse.json(
        { success: false, error: 'courseId and messages are required' },
        { status: 400 }
      )
    }

    // Verify course access (skip for ADMIN)
    if (user.role !== 'ADMIN') {
      const access = await db.courseAccess.findUnique({
        where: { userId_courseId: { userId: user.id, courseId } },
      })
      if (!access) {
        return NextResponse.json(
          { success: false, error: 'No tienes acceso a este curso' },
          { status: 403 }
        )
      }
      if (access.accessUntil && access.accessUntil < new Date()) {
        return NextResponse.json(
          { success: false, error: 'Tu acceso a este curso ha expirado' },
          { status: 403 }
        )
      }
    }

    // Fetch course context
    const course = await db.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: { orderBy: { order: 'asc' } },
          },
        },
      },
    })

    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 })
    }

    const courseContext = buildCourseContext(course, moduleId)
    const systemPrompt = buildSystemPrompt(course.title, courseContext)

    // Call GPT-4o
    const openai = getOpenAI()
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-20),
      ],
      max_tokens: 1000,
      temperature: 0.7,
    })

    const assistantMessage =
      completion.choices[0]?.message?.content ??
      'Lo siento, no pude generar una respuesta en este momento. Por favor intenta de nuevo.'

    return NextResponse.json({
      success: true,
      data: { message: assistantMessage },
    })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error del servicio de IA',
      },
      { status: 500 }
    )
  }
}

import { Role } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { isCourseAccessActive } from '@/lib/course-access'
import { db } from '@/lib/db'

export type AppUser = {
  id: string
  email: string
  role: Role
}

export type AccessFailureCode =
  | 'SIGN_IN_REQUIRED'
  | 'USER_NOT_FOUND'
  | 'COURSE_NOT_FOUND'
  | 'MODULE_NOT_FOUND'
  | 'STYLE_NOT_FOUND'
  | 'CHAT_ROOM_NOT_FOUND'
  | 'COURSE_PURCHASE_REQUIRED'
  | 'COURSE_ACCESS_EXPIRED'
  | 'COURSE_ACCESS_REVOKED'

type AccessFailure = {
  ok: false
  status: number
  code: AccessFailureCode
  message: string
}

type CourseAccessSuccess = {
  ok: true
  user: AppUser
  courseId: string
  accessUntil: Date | null
  isExpired: boolean
  viaAdmin: boolean
}

type ModuleAccessSuccess = CourseAccessSuccess & {
  module: {
    id: string
    courseId: string
    order?: number
    title?: string
  }
}

export type CourseAccessResult = CourseAccessSuccess | AccessFailure
export type ModuleAccessResult = ModuleAccessSuccess | AccessFailure
export type StyleAccessResult = (CourseAccessSuccess & {
  style: {
    id: string
    courseId: string
    order?: number
    name?: string
  }
}) | AccessFailure
export type ChatRoomAccessResult =
  | (CourseAccessSuccess & {
      room: {
        id: string
        courseId: string | null
        type: 'COURSE' | 'COMMUNITY'
      }
    })
  | AccessFailure

async function getCurrentAppUser(): Promise<AppUser | AccessFailure> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return {
      ok: false,
      status: 401,
      code: 'SIGN_IN_REQUIRED',
      message: 'Debes iniciar sesion para acceder a este contenido.',
    }
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, role: true },
  })

  if (!user) {
    return {
      ok: false,
      status: 404,
      code: 'USER_NOT_FOUND',
      message: 'No encontramos tu usuario en la plataforma.',
    }
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
  }
}

export function toAccessDeniedResponse(result: AccessFailure) {
  return NextResponse.json(
    {
      success: false,
      error: result.message,
      code: result.code,
    },
    { status: result.status }
  )
}

export async function authorizeCourseAccessByCourseId(
  courseId: string,
  options: {
    allowAdmin?: boolean
    requireActiveAccess?: boolean
  } = {}
): Promise<CourseAccessResult> {
  const { allowAdmin = false, requireActiveAccess = true } = options
  const user = await getCurrentAppUser()

  if ('ok' in user && !user.ok) {
    return user
  }

  const appUser = user as AppUser

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  })

  if (!course) {
    return {
      ok: false,
      status: 404,
      code: 'COURSE_NOT_FOUND',
      message: 'El curso solicitado no existe.',
    }
  }

  if (allowAdmin && appUser.role === 'ADMIN') {
    return {
      ok: true,
      user: appUser,
      courseId,
      accessUntil: null,
      isExpired: false,
      viaAdmin: true,
    }
  }

  const access = await db.courseAccess.findUnique({
    where: {
      userId_courseId: { userId: appUser.id, courseId },
    },
    select: {
      accessUntil: true,
      revokedAt: true,
    },
  })

  if (!access) {
    return {
      ok: false,
      status: 403,
      code: 'COURSE_PURCHASE_REQUIRED',
      message: 'Necesitas haber comprado este curso para acceder.',
    }
  }

  const isExpired = !!(access.accessUntil && access.accessUntil < new Date())

  if (access.revokedAt) {
    return {
      ok: false,
      status: 403,
      code: 'COURSE_ACCESS_REVOKED',
      message: 'Tu acceso a este curso fue revocado porque el pago ya no es válido.',
    }
  }

  if (requireActiveAccess && !isCourseAccessActive(access)) {
    return {
      ok: false,
      status: 403,
      code: 'COURSE_ACCESS_EXPIRED',
      message: 'Tu acceso a este curso ha expirado.',
    }
  }

  return {
    ok: true,
    user: appUser,
    courseId,
    accessUntil: access.accessUntil,
    isExpired,
    viaAdmin: false,
  }
}

export async function authorizeCourseAccessByModuleId(
  moduleId: string,
  options: {
    allowAdmin?: boolean
    requireActiveAccess?: boolean
  } = {}
): Promise<ModuleAccessResult> {
  const { allowAdmin = false, requireActiveAccess = true } = options
  const user = await getCurrentAppUser()

  if ('ok' in user && !user.ok) {
    return user
  }

  const appUser = user as AppUser

  const courseModule = await db.module.findUnique({
    where: { id: moduleId },
    select: { id: true, courseId: true, order: true, title: true },
  })

  if (!courseModule) {
    return {
      ok: false,
      status: 404,
      code: 'MODULE_NOT_FOUND',
      message: 'El modulo solicitado no existe.',
    }
  }

  if (allowAdmin && appUser.role === 'ADMIN') {
    return {
      ok: true,
      user: appUser,
      courseId: courseModule.courseId,
      accessUntil: null,
      isExpired: false,
      viaAdmin: true,
      module: courseModule,
    }
  }

  const access = await db.courseAccess.findUnique({
    where: {
      userId_courseId: { userId: appUser.id, courseId: courseModule.courseId },
    },
    select: {
      accessUntil: true,
      revokedAt: true,
    },
  })

  if (!access) {
    return {
      ok: false,
      status: 403,
      code: 'COURSE_PURCHASE_REQUIRED',
      message: 'Necesitas haber comprado este curso para acceder.',
    }
  }

  const isExpired = !!(access.accessUntil && access.accessUntil < new Date())

  if (access.revokedAt) {
    return {
      ok: false,
      status: 403,
      code: 'COURSE_ACCESS_REVOKED',
      message: 'Tu acceso a este curso fue revocado porque el pago ya no es válido.',
    }
  }

  if (requireActiveAccess && !isCourseAccessActive(access)) {
    return {
      ok: false,
      status: 403,
      code: 'COURSE_ACCESS_EXPIRED',
      message: 'Tu acceso a este curso ha expirado.',
    }
  }

  return {
    ok: true,
    user: appUser,
    courseId: courseModule.courseId,
    accessUntil: access.accessUntil,
    isExpired,
    viaAdmin: false,
    module: courseModule,
  }
}

export async function authorizeCourseAccessByStyleId(
  styleId: string,
  options: {
    allowAdmin?: boolean
    requireActiveAccess?: boolean
  } = {}
): Promise<StyleAccessResult> {
  const style = await db.moduleStyle.findUnique({
    where: { id: styleId },
    select: { id: true, courseId: true, order: true, name: true },
  })

  if (!style) {
    return {
      ok: false,
      status: 404,
      code: 'STYLE_NOT_FOUND',
      message: 'El estilo solicitado no existe.',
    }
  }

  const courseAccess = await authorizeCourseAccessByCourseId(style.courseId, options)
  if (!courseAccess.ok) return courseAccess

  return { ...courseAccess, style }
}

export async function authorizeChatRoomAccessByRoomId(
  roomId: string,
  options: {
    allowAdmin?: boolean
    requireActiveAccess?: boolean
  } = {}
): Promise<ChatRoomAccessResult> {
  const { allowAdmin = false, requireActiveAccess = true } = options
  const user = await getCurrentAppUser()

  if ('ok' in user && !user.ok) {
    return user
  }

  const appUser = user as AppUser

  const room = await db.chatRoom.findUnique({
    where: { id: roomId },
    select: { id: true, courseId: true, type: true },
  })

  if (!room) {
    return {
      ok: false,
      status: 404,
      code: 'CHAT_ROOM_NOT_FOUND',
      message: 'La sala solicitada no existe.',
    }
  }

  if (room.type === 'COMMUNITY' || !room.courseId) {
    return {
      ok: true,
      user: appUser,
      courseId: '',
      accessUntil: null,
      isExpired: false,
      viaAdmin: false,
      room,
    }
  }

  const courseAccess = await authorizeCourseAccessByCourseId(room.courseId, {
    allowAdmin,
    requireActiveAccess,
  })

  if (!courseAccess.ok) {
    return courseAccess
  }

  return {
    ...courseAccess,
    room,
  }
}

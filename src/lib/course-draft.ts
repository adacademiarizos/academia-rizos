import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { slugifyStyleName } from '@/lib/academy-content'
import { db } from '@/lib/db'

export const COURSE_DRAFT_SCHEMA_VERSION = 3

export const CourseContentStructureSchema = z.enum(['MODULES', 'STYLES', 'BOTH'])
export type CourseContentStructure = z.infer<typeof CourseContentStructureSchema>

const PersistedId = z.string().min(1).optional()
const ClientId = z.string().min(1)
const NullableText = z.string().nullable()

const LessonDraftSchema = z.object({
  id: PersistedId,
  clientId: ClientId,
  order: z.number().int().min(0),
  title: z.string().trim().min(1),
  description: NullableText,
  videoFileUrl: NullableText,
})

const ModuleDraftSchema = z.object({
  id: PersistedId,
  clientId: ClientId,
  order: z.number().int().min(0),
  title: z.string().trim().min(1),
  description: NullableText,
  videoFileUrl: NullableText,
  lessons: z.array(LessonDraftSchema),
})

const StyleDraftSchema = z.object({
  id: PersistedId,
  clientId: ClientId,
  order: z.number().int().min(0),
  name: z.string().trim().min(1),
  description: NullableText,
  isActive: z.boolean(),
  lessons: z.array(LessonDraftSchema),
})

const CourseDetailsDraftSchema = z.object({
  title: z.string().trim().min(1),
  description: NullableText,
  trailerUrl: NullableText,
  thumbnailUrl: NullableText,
  priceCents: z.number().int().min(0),
  rentalDays: z.number().int().positive().nullable(),
  isActive: z.boolean(),
  contentStructure: CourseContentStructureSchema,
})

export const CourseDraftPayloadSchema = z.object({
  schemaVersion: z.literal(COURSE_DRAFT_SCHEMA_VERSION),
  course: CourseDetailsDraftSchema,
  modules: z.array(ModuleDraftSchema),
  styles: z.array(StyleDraftSchema),
})

// These schemas intentionally only read the fields that can be safely
// migrated from the two previous editor payload shapes.
const LegacyLessonDraftSchema = LessonDraftSchema
const LegacyModuleDraftSchema = ModuleDraftSchema
const LegacyStyleV2Schema = StyleDraftSchema.omit({ lessons: true }).extend({
  modules: z.array(LegacyModuleDraftSchema),
})
const LegacyV2PayloadSchema = z.object({
  schemaVersion: z.literal(2),
  course: CourseDetailsDraftSchema.omit({ contentStructure: true }),
  styles: z.array(LegacyStyleV2Schema),
})
const LegacyStyleV1Schema = StyleDraftSchema.omit({ lessons: true }).extend({
  lessons: z.array(LegacyLessonDraftSchema),
})
const LegacyModuleV1Schema = LegacyModuleDraftSchema.omit({ lessons: true }).extend({
  styles: z.array(LegacyStyleV1Schema),
})
const LegacyV1PayloadSchema = z.object({
  schemaVersion: z.literal(1),
  course: CourseDetailsDraftSchema.omit({ contentStructure: true }),
  modules: z.array(LegacyModuleV1Schema),
})

export type CourseDraftPayload = z.infer<typeof CourseDraftPayloadSchema>
export type DraftLesson = z.infer<typeof LessonDraftSchema>
export type DraftModule = z.infer<typeof ModuleDraftSchema>
export type DraftStyle = z.infer<typeof StyleDraftSchema>

export class CourseDraftValidationError extends Error {}

const editorInclude = {
  modules: {
    orderBy: { order: 'asc' as const },
    include: { lessons: { orderBy: { order: 'asc' as const } } },
  },
  styles: {
    orderBy: { order: 'asc' as const },
    include: { lessons: { orderBy: { order: 'asc' as const } } },
  },
}

type PublishedCourse = Prisma.CourseGetPayload<{ include: typeof editorInclude }>

function persistedClientId(id: string) {
  return `published:${id}`
}

export function draftRouteId(entity: { id?: string; clientId: string }) {
  return entity.id ?? entity.clientId
}

export function legacyMigratedStyleRouteId(name: string) {
  return `draft:migrated-style:${slugifyStyleName(name)}`
}

function toDraftLesson(lesson: { id: string; order: number; title: string; description: string | null; videoFileUrl: string | null }): DraftLesson {
  return {
    id: lesson.id,
    clientId: persistedClientId(lesson.id),
    order: lesson.order,
    title: lesson.title,
    description: lesson.description,
    videoFileUrl: lesson.videoFileUrl,
  }
}

function toDraftModule(module: PublishedCourse['modules'][number]): DraftModule {
  return {
    id: module.id,
    clientId: persistedClientId(module.id),
    order: module.order,
    title: module.title,
    description: module.description,
    videoFileUrl: module.videoFileUrl,
    lessons: module.lessons
      .filter((lesson) => lesson.styleId === null)
      .map(toDraftLesson),
  }
}

function toDraftStyle(style: PublishedCourse['styles'][number]): DraftStyle {
  return {
    id: style.id,
    clientId: persistedClientId(style.id),
    order: style.order,
    name: style.name,
    description: style.description,
    isActive: style.isActive,
    lessons: style.lessons
      .filter((lesson) => lesson.moduleId === null)
      .map(toDraftLesson),
  }
}

export function buildPublishedCourseDraft(course: PublishedCourse): CourseDraftPayload {
  if (!course.contentStructure) {
    return buildLegacyCourseDraft(course)
  }

  const structure = course.contentStructure as CourseContentStructure
  return {
    schemaVersion: COURSE_DRAFT_SCHEMA_VERSION,
    course: {
      title: course.title,
      description: course.description,
      trailerUrl: course.trailerUrl,
      thumbnailUrl: course.thumbnailUrl,
      priceCents: course.priceCents,
      rentalDays: course.rentalDays,
      isActive: course.isActive,
      contentStructure: structure,
    },
    modules: structure === 'STYLES'
      ? []
      : course.modules.filter((module) => module.styleId === null).map(toDraftModule),
    styles: structure === 'MODULES'
      ? []
      : course.styles.map(toDraftStyle),
  }
}

function buildLegacyCourseDraft(course: PublishedCourse): CourseDraftPayload {
  return {
    schemaVersion: COURSE_DRAFT_SCHEMA_VERSION,
    course: {
      title: course.title,
      description: course.description,
      trailerUrl: course.trailerUrl,
      thumbnailUrl: course.thumbnailUrl,
      priceCents: course.priceCents,
      rentalDays: course.rentalDays,
      isActive: course.isActive,
      contentStructure: 'MODULES',
    },
    modules: course.modules.map((module) => ({
      id: module.id,
      clientId: persistedClientId(module.id),
      order: module.order,
      title: module.title,
      description: module.description,
      videoFileUrl: module.videoFileUrl,
      lessons: module.lessons.map(toDraftLesson),
    })),
    styles: [],
  }
}

function migrateLegacyDraft(rawPayload: unknown, publishedCourse: PublishedCourse): CourseDraftPayload {
  const legacyV2 = LegacyV2PayloadSchema.safeParse(rawPayload)
  if (legacyV2.success) {
    const structure = (publishedCourse.contentStructure ?? 'MODULES') as CourseContentStructure
    const flattenedModules = legacyV2.data.styles.flatMap((style) => style.modules)
    return {
      schemaVersion: COURSE_DRAFT_SCHEMA_VERSION,
      course: { ...legacyV2.data.course, contentStructure: structure },
      modules: structure === 'STYLES' ? [] : flattenedModules.map((module) => ({
        id: module.id,
        clientId: module.clientId,
        order: module.order,
        title: module.title,
        description: module.description,
        videoFileUrl: module.videoFileUrl,
        lessons: module.lessons.map((lesson) => ({
          id: lesson.id,
          clientId: lesson.clientId,
          order: lesson.order,
          title: lesson.title,
          description: lesson.description,
          videoFileUrl: lesson.videoFileUrl,
        })),
      })),
      styles: structure === 'MODULES' ? [] : legacyV2.data.styles.map((style) => ({
        id: style.id,
        clientId: style.clientId,
        order: style.order,
        name: style.name,
        description: style.description,
        isActive: style.isActive,
        lessons: style.modules.flatMap((module) => module.lessons).map((lesson, order) => ({
          id: lesson.id,
          clientId: lesson.clientId,
          order,
          title: lesson.title,
          description: lesson.description,
          videoFileUrl: lesson.videoFileUrl,
        })),
      })),
    }
  }

  const legacyV1 = LegacyV1PayloadSchema.parse(rawPayload)
  return {
    schemaVersion: COURSE_DRAFT_SCHEMA_VERSION,
    course: { ...legacyV1.course, contentStructure: (publishedCourse.contentStructure ?? 'MODULES') as CourseContentStructure },
    modules: legacyV1.modules.map((module) => ({
      id: module.id,
      clientId: module.clientId,
      order: module.order,
      title: module.title,
      description: module.description,
      videoFileUrl: module.videoFileUrl,
      lessons: module.styles.flatMap((style) => style.lessons).map((lesson, order) => ({
        id: lesson.id,
        clientId: lesson.clientId,
        order,
        title: lesson.title,
        description: lesson.description,
        videoFileUrl: lesson.videoFileUrl,
      })),
    })),
    styles: [],
  }
}

export async function loadPublishedCourseDraft(courseId: string): Promise<CourseDraftPayload | null> {
  const course = await db.course.findUnique({ where: { id: courseId }, include: editorInclude })
  return course ? buildPublishedCourseDraft(course) : null
}

export async function loadCourseEditorDraft(courseId: string) {
  const [course, savedDraft] = await Promise.all([
    db.course.findUnique({ where: { id: courseId }, include: editorInclude }),
    db.courseDraft.findUnique({ where: { courseId } }),
  ])
  if (!course) return null

  const publishedCourse = course as PublishedCourse
  if (savedDraft) {
    const currentDraft = CourseDraftPayloadSchema.safeParse(savedDraft.payload)
    return {
      payload: currentDraft.success ? currentDraft.data : migrateLegacyDraft(savedDraft.payload, publishedCourse),
      source: 'DRAFT' as const,
      updatedAt: savedDraft.updatedAt,
      needsStructureMigration: !course.contentStructure,
    }
  }

  return {
    payload: buildPublishedCourseDraft(publishedCourse),
    source: 'PUBLISHED' as const,
    updatedAt: course.updatedAt,
    needsStructureMigration: !course.contentStructure,
  }
}

function assertUniqueOrders(items: Array<{ order: number }>, label: string) {
  const orders = new Set<number>()
  for (const item of items) {
    if (orders.has(item.order)) throw new CourseDraftValidationError(`${label} contains duplicate order values`)
    orders.add(item.order)
  }
}

function assertUniquePersistedIds(items: Array<{ id?: string }>, label: string) {
  const ids = new Set<string>()
  for (const item of items) {
    if (!item.id) continue
    if (ids.has(item.id)) throw new CourseDraftValidationError(`${label} appears more than once in the draft`)
    ids.add(item.id)
  }
}

function validateLessons(lessons: DraftLesson[], label: string) {
  assertUniqueOrders(lessons, `Lessons in ${label}`)
  assertUniquePersistedIds(lessons, 'A lesson')
}

function validateDraft(payload: CourseDraftPayload) {
  const { contentStructure } = payload.course
  if (contentStructure === 'MODULES' && payload.styles.length > 0) {
    throw new CourseDraftValidationError('Module courses cannot contain styles')
  }
  if (contentStructure === 'STYLES' && payload.modules.length > 0) {
    throw new CourseDraftValidationError('Style courses cannot contain modules')
  }

  assertUniqueOrders(payload.modules, 'Modules')
  assertUniquePersistedIds(payload.modules, 'A module')
  for (const moduleDraft of payload.modules) validateLessons(moduleDraft.lessons, `module ${moduleDraft.title}`)

  assertUniqueOrders(payload.styles, 'Styles')
  assertUniquePersistedIds(payload.styles, 'A style')
  const slugs = new Set<string>()
  for (const style of payload.styles) {
    const slug = slugifyStyleName(style.name)
    if (slugs.has(slug)) throw new CourseDraftValidationError('Style names must be unique in a course')
    slugs.add(slug)
    validateLessons(style.lessons, `style ${style.name}`)
  }
}

function cleanNullable(value: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function saveCourseDraft(courseId: string, rawPayload: unknown) {
  const payload = CourseDraftPayloadSchema.parse(rawPayload)
  validateDraft(payload)
  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true, contentStructure: true } })
  if (!course) return null
  if (course.contentStructure && course.contentStructure !== payload.course.contentStructure) {
    throw new CourseDraftValidationError('The course structure cannot be changed after creation')
  }

  return db.courseDraft.upsert({
    where: { courseId },
    create: { courseId, schemaVersion: COURSE_DRAFT_SCHEMA_VERSION, payload },
    update: { schemaVersion: COURSE_DRAFT_SCHEMA_VERSION, payload },
  })
}

export async function discardCourseDraft(courseId: string) {
  await db.courseDraft.deleteMany({ where: { courseId } })
}

export async function publishCourseDraft(courseId: string, rawPayload: unknown) {
  const payload = CourseDraftPayloadSchema.parse(rawPayload)
  validateDraft(payload)

  return db.$transaction(async (tx) => {
    const existing = await tx.course.findUnique({ where: { id: courseId }, select: { id: true, contentStructure: true } })
    if (!existing) return null
    if (existing.contentStructure && existing.contentStructure !== payload.course.contentStructure) {
      throw new CourseDraftValidationError('The course structure cannot be changed after creation')
    }

    await tx.course.update({
      where: { id: courseId },
      data: {
        title: payload.course.title,
        description: cleanNullable(payload.course.description),
        trailerUrl: cleanNullable(payload.course.trailerUrl),
        thumbnailUrl: cleanNullable(payload.course.thumbnailUrl),
        priceCents: payload.course.priceCents,
        rentalDays: payload.course.rentalDays,
        isActive: payload.course.isActive,
        contentStructure: payload.course.contentStructure,
      },
    })

    await syncCourseModules(tx, courseId, payload.modules)
    await syncCourseStyles(tx, courseId, payload.styles)
    await tx.courseDraft.deleteMany({ where: { courseId } })
    return tx.course.findUnique({ where: { id: courseId } })
  })
}

async function syncCourseModules(tx: Prisma.TransactionClient, courseId: string, modules: DraftModule[]) {
  const current = await tx.module.findMany({ where: { courseId, styleId: null }, select: { id: true } })
  const currentIds = new Set(current.map((module) => module.id))
  for (const moduleDraft of modules) {
    if (moduleDraft.id && !currentIds.has(moduleDraft.id)) {
      throw new CourseDraftValidationError('The draft contains a module from another course')
    }
  }

  await tx.module.updateMany({ where: { courseId, styleId: null }, data: { order: { increment: 1_000_000 } } })
  const publishedIds: string[] = []
  for (const moduleDraft of modules) {
    const data = {
      order: moduleDraft.order,
      title: moduleDraft.title,
      description: cleanNullable(moduleDraft.description),
      videoFileUrl: cleanNullable(moduleDraft.videoFileUrl),
      styleId: null,
    }
    const record = moduleDraft.id
      ? await tx.module.update({ where: { id: moduleDraft.id }, data })
      : await tx.module.create({ data: { courseId, ...data } })
    publishedIds.push(record.id)
    await syncLessons(tx, courseId, { moduleId: record.id }, moduleDraft.lessons)
  }
  await tx.module.deleteMany({ where: { courseId, styleId: null, id: { notIn: publishedIds } } })
}

async function syncCourseStyles(tx: Prisma.TransactionClient, courseId: string, styles: DraftStyle[]) {
  const current = await tx.moduleStyle.findMany({ where: { courseId }, select: { id: true } })
  const currentIds = new Set(current.map((style) => style.id))
  for (const style of styles) {
    if (style.id && !currentIds.has(style.id)) {
      throw new CourseDraftValidationError('The draft contains a style from another course')
    }
  }

  await tx.moduleStyle.updateMany({ where: { courseId }, data: { order: { increment: 1_000_000 } } })
  await Promise.all(current.map((style) => tx.moduleStyle.update({ where: { id: style.id }, data: { slug: `__draft_${style.id}` } })))

  const publishedIds: string[] = []
  for (const style of styles) {
    const data = {
      order: style.order,
      name: style.name,
      slug: slugifyStyleName(style.name),
      description: cleanNullable(style.description),
      isActive: style.isActive,
    }
    const record = style.id
      ? await tx.moduleStyle.update({ where: { id: style.id }, data })
      : await tx.moduleStyle.create({ data: { courseId, ...data } })
    publishedIds.push(record.id)
    await syncLessons(tx, courseId, { styleId: record.id }, style.lessons)
  }
  await tx.moduleStyle.deleteMany({ where: { courseId, id: { notIn: publishedIds } } })
}

async function syncLessons(
  tx: Prisma.TransactionClient,
  courseId: string,
  parent: { moduleId: string } | { styleId: string },
  lessons: DraftLesson[]
) {
  const where = 'moduleId' in parent
    ? { courseId, moduleId: parent.moduleId, styleId: null }
    : { courseId, styleId: parent.styleId, moduleId: null }
  const current = await tx.lesson.findMany({ where, select: { id: true } })
  const currentIds = new Set(current.map((lesson) => lesson.id))
  for (const lesson of lessons) {
    if (lesson.id && !currentIds.has(lesson.id)) {
      throw new CourseDraftValidationError('The draft contains a lesson from another container')
    }
  }

  await tx.lesson.updateMany({ where, data: { order: { increment: 1_000_000 } } })
  const publishedIds: string[] = []
  for (const lesson of lessons) {
    const data = {
      courseId,
      order: lesson.order,
      title: lesson.title,
      description: cleanNullable(lesson.description),
      videoFileUrl: cleanNullable(lesson.videoFileUrl),
      moduleId: 'moduleId' in parent ? parent.moduleId : null,
      styleId: 'styleId' in parent ? parent.styleId : null,
    }
    const record = lesson.id
      ? await tx.lesson.update({ where: { id: lesson.id }, data })
      : await tx.lesson.create({ data })
    publishedIds.push(record.id)
  }
  await tx.lesson.deleteMany({ where: { ...where, id: { notIn: publishedIds } } })
}

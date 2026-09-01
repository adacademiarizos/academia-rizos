import type { Prisma } from '@prisma/client'

export const moduleAuthoringSelect = {
  id: true,
  courseId: true,
  styleId: true,
  order: true,
  title: true,
  description: true,
  videoUrl: true,
  videoFileUrl: true,
  bannerImageUrl: true,
  transcript: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ModuleSelect

export const lessonAuthoringSelect = {
  id: true,
  courseId: true,
  moduleId: true,
  styleId: true,
  order: true,
  title: true,
  description: true,
  videoUrl: true,
  videoFileUrl: true,
  transcript: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LessonSelect

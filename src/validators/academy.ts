import { z } from 'zod'

// Course Validators

export const createCourseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(255),
  description: z.string().optional(),
  trailerUrl: z.string().url().optional().or(z.literal('')),
  priceCents: z.number().int().min(0),
  currency: z.string().default('EUR'),
  rentalDays: z.number().int().positive().optional(),
})

export const updateCourseSchema = createCourseSchema.partial()

// Module Validators

export const createModuleSchema = z.object({
  courseId: z.string().cuid(),
  order: z.number().int().positive(),
  title: z.string().min(3, 'Title must be at least 3 characters').max(255),
  description: z.string().optional(),
  videoUrl: z.string().url('Invalid video URL'),
  transcript: z.string().optional(),
})

export const updateModuleSchema = createModuleSchema.partial().omit({ courseId: true })

// Resource Validators

export const uploadResourceSchema = z.object({
  courseId: z.string().cuid(),
  type: z.enum(['PDF', 'IMAGE']),
  fileName: z.string().min(1).max(255),
})

// Test Validators

export const testQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['multipleChoice', 'text', 'fileUpload']),
  text: z.string().min(5),
  options: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    })
  ).optional(),
  correctAnswer: z.string().optional(),
  required: z.boolean().optional(),
})

export const testSchemaValidator = z.object({
  questions: z.array(testQuestionSchema).min(1),
  passingScore: z.number().int().min(0).max(100).optional(),
  maxAttempts: z.number().int().positive().optional(),
})

export const createTestSchema = z.object({
  courseId: z.string().cuid(),
  schemaJson: testSchemaValidator,
})

// Submission Validators

export const submissionAnswerSchema = z.object({
  questionId: z.string(),
  answer: z.union([z.string(), z.array(z.string())]),
})

export const evidenceSchema = z.object({
  url: z.string().url(),
  type: z.string(),
  fileName: z.string().optional(),
})

export const submitTestSchema = z.object({
  testId: z.string().cuid(),
  courseId: z.string().cuid(),
  answers: z.array(submissionAnswerSchema),
  evidence: z.array(evidenceSchema).optional(),
})

// Comment Validators

export const createCommentSchema = z.object({
  body: z.string()
    .min(1, 'Comment cannot be empty')
    .max(500, 'Comment must be less than 500 characters'),
  targetType: z.enum(['COURSE', 'MODULE']),
  courseId: z.string().cuid().optional(),
  moduleId: z.string().cuid().optional(),
}).refine(
  (data) => data.courseId || data.moduleId,
  {
    message: 'Either courseId or moduleId must be provided',
    path: ['courseId'],
  }
)

// Like Validators

export const createLikeSchema = z.object({
  targetType: z.enum(['COURSE', 'MODULE']),
  courseId: z.string().cuid().optional(),
  moduleId: z.string().cuid().optional(),
}).refine(
  (data) => data.courseId || data.moduleId,
  {
    message: 'Either courseId or moduleId must be provided',
    path: ['courseId'],
  }
)

// Chat Message Validators

export const createChatMessageSchema = z.object({
  roomId: z.string().cuid(),
  body: z.string()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message must be less than 1000 characters'),
})

// Export types

export type CreateCourseInput = z.infer<typeof createCourseSchema>
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>
export type CreateModuleInput = z.infer<typeof createModuleSchema>
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>
export type UploadResourceInput = z.infer<typeof uploadResourceSchema>
export type CreateTestInput = z.infer<typeof createTestSchema>
export type SubmitTestInput = z.infer<typeof submitTestSchema>
export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type CreateLikeInput = z.infer<typeof createLikeSchema>
export type CreateChatMessageInput = z.infer<typeof createChatMessageSchema>

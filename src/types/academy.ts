// Course & Learning Types

export type Course = {
  id: string
  title: string
  description?: string | null
  trailerUrl?: string | null
  thumbnailUrl?: string | null
  priceCents: number       // net price admin receives
  totalPriceCents: number  // what the customer pays (base + Stripe fees)
  feeCents: number         // Stripe fee amount
  currency: string
  rentalDays?: number | null
  isActive: boolean
  moduleCount?: number
  totalHours?: number
  createdAt: Date
  updatedAt: Date
}

export type Module = {
  id: string
  courseId: string
  order: number
  title: string
  description?: string | null
  videoUrl?: string | null
  transcript?: string | null
  createdAt: Date
  updatedAt: Date
}

export type ModuleStyle = {
  id: string
  moduleId: string
  order: number
  name: string
  slug: string
  description?: string | null
  isActive: boolean
  lessons?: Lesson[]
  createdAt: Date
  updatedAt: Date
}

export type Lesson = {
  id: string
  moduleId: string
  styleId: string
  order: number
  title: string
  description?: string | null
  videoUrl?: string | null
  videoFileUrl?: string | null
  transcript?: string | null
  styleName?: string
  createdAt: Date
  updatedAt: Date
}

export type ModuleProgress = {
  id: string
  userId: string
  moduleId: string
  completed: boolean
  completedAt?: Date | null
}

export type CourseAccess = {
  id: string
  userId: string
  courseId: string
  accessUntil?: Date | null
  revokedAt?: Date | null
  createdAt: Date
}

export type Resource = {
  id: string
  courseId: string
  type: 'PDF' | 'IMAGE'
  fileUrl: string
  fileName?: string | null
  createdAt: Date
}

// Test & Evaluation Types

export type TestQuestion = {
  id: string
  type: 'multipleChoice' | 'text' | 'fileUpload'
  text: string
  options?: {
    label: string
    value: string
  }[]
  correctAnswer?: string
  required?: boolean
}

export type TestSchema = {
  questions: TestQuestion[]
  passingScore?: number
  maxAttempts?: number
}

export type Test = {
  id: string
  courseId: string
  schemaJson: TestSchema
  createdAt: Date
  updatedAt: Date
}

export type SubmissionAnswer = {
  questionId: string
  answer: string | string[]
}

export type Evidence = {
  url: string
  type: string // 'image', 'video', 'pdf'
  fileName?: string
}

export type Submission = {
  id: string
  testId: string
  userId: string
  answersJson: SubmissionAnswer[]
  evidenceJson?: Evidence[] | null
  status: 'PENDING' | 'REVISION_REQUESTED' | 'APPROVED'
  feedback?: string | null
  reviewedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

// Certificate Types

export type Certificate = {
  id: string
  code: string
  courseId: string
  userId: string
  submissionId?: string | null
  issuedAt: Date
  pdfUrl?: string | null
  valid: boolean
}

// Community Types

export type Like = {
  id: string
  userId: string
  targetType: 'COURSE' | 'MODULE'
  courseId?: string | null
  moduleId?: string | null
  createdAt: Date
}

export type Comment = {
  id: string
  userId: string
  targetType: 'COURSE' | 'MODULE'
  courseId?: string | null
  moduleId?: string | null
  body: string
  createdAt: Date
  user?: {
    id: string
    name?: string | null
    image?: string | null
  }
}

export type ChatRoom = {
  id: string
  courseId: string
  createdAt: Date
}

export type ChatMessage = {
  id: string
  roomId: string
  userId: string
  body: string
  createdAt: Date
  user?: {
    id: string
    name?: string | null
    image?: string | null
  }
}

// API Request/Response Types

export type CreateCourseRequest = {
  title: string
  description?: string
  trailerUrl?: string
  priceCents: number
  currency?: string
  rentalDays?: number
}

export type UpdateCourseRequest = Partial<CreateCourseRequest>

export type CreateModuleRequest = {
  courseId: string
  order: number
  title: string
  description?: string
  videoUrl: string
  transcript?: string
}

export type UpdateModuleRequest = Partial<CreateModuleRequest>

export type CreateModuleStyleRequest = {
  moduleId: string
  name: string
  description?: string | null
  order?: number
  isActive?: boolean
}

export type UpdateModuleStyleRequest = Partial<Omit<CreateModuleStyleRequest, 'moduleId'>>

export type CreateLessonRequest = {
  styleId: string
  title: string
  description?: string | null
  videoUrl?: string | null
  videoFileUrl?: string | null
  transcript?: string | null
  order?: number
}

export type UpdateLessonRequest = Partial<Omit<CreateLessonRequest, 'styleId'>>

export type CreateTestRequest = {
  courseId: string
  schemaJson: TestSchema
}

export type SubmitTestRequest = {
  testId: string
  courseId: string
  answers: SubmissionAnswer[]
  evidence?: Evidence[]
}

export type UploadResourceRequest = {
  courseId: string
  type: 'PDF' | 'IMAGE'
  fileName: string
}

// Enrollment & Progress Types

export type CourseEnrollment = {
  course: Course
  access: CourseAccess
  progress: {
    totalModules: number
    completedModules: number
    percentComplete: number
  }
  test?: {
    id: string
    status: 'LOCKED' | 'AVAILABLE' | 'COMPLETED' | 'PENDING_REVIEW' | 'APPROVED'
  }
  certificate?: Certificate
}

export type LearningProgress = {
  courseId: string
  userId: string
  completedModules: number[]
  lastAccessedAt: Date
  percentComplete: number
}

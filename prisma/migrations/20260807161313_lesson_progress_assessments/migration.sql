-- CreateEnum
CREATE TYPE "FinalExamQuestionType" AS ENUM ('WRITTEN', 'PHOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "FinalExamAttemptStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'NOT_PASSED');

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonTest" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonTestQuestion" (
    "id" TEXT NOT NULL,
    "lessonTestId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonTestQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonTestSubmission" (
    "id" TEXT NOT NULL,
    "lessonTestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "isPassed" BOOLEAN NOT NULL DEFAULT false,
    "attemptNumber" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonTestSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonTestAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonTestAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalExam" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Examen final',
    "description" TEXT,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalExamQuestion" (
    "id" TEXT NOT NULL,
    "finalExamId" TEXT NOT NULL,
    "type" "FinalExamQuestionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalExamAttempt" (
    "id" TEXT NOT NULL,
    "finalExamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "FinalExamAttemptStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinalExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalExamAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "responseText" TEXT,
    "fileUrl" TEXT,
    "fileMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinalExamAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalExamRevalidation" (
    "id" TEXT NOT NULL,
    "finalExamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "attemptsGranted" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinalExamRevalidation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonProgress_lessonId_idx" ON "LessonProgress"("lessonId");

-- CreateIndex
CREATE INDEX "LessonProgress_userId_idx" ON "LessonProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_userId_lessonId_key" ON "LessonProgress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "LessonTest_lessonId_order_idx" ON "LessonTest"("lessonId", "order");

-- CreateIndex
CREATE INDEX "LessonTestQuestion_lessonTestId_order_idx" ON "LessonTestQuestion"("lessonTestId", "order");

-- CreateIndex
CREATE INDEX "LessonTestSubmission_lessonTestId_userId_idx" ON "LessonTestSubmission"("lessonTestId", "userId");

-- CreateIndex
CREATE INDEX "LessonTestSubmission_userId_idx" ON "LessonTestSubmission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonTestSubmission_lessonTestId_userId_attemptNumber_key" ON "LessonTestSubmission"("lessonTestId", "userId", "attemptNumber");

-- CreateIndex
CREATE INDEX "LessonTestAnswer_questionId_idx" ON "LessonTestAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonTestAnswer_submissionId_questionId_key" ON "LessonTestAnswer"("submissionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalExam_courseId_key" ON "FinalExam"("courseId");

-- CreateIndex
CREATE INDEX "FinalExamQuestion_finalExamId_order_idx" ON "FinalExamQuestion"("finalExamId", "order");

-- CreateIndex
CREATE INDEX "FinalExamAttempt_finalExamId_userId_status_idx" ON "FinalExamAttempt"("finalExamId", "userId", "status");

-- CreateIndex
CREATE INDEX "FinalExamAttempt_userId_status_idx" ON "FinalExamAttempt"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinalExamAttempt_finalExamId_userId_attemptNumber_key" ON "FinalExamAttempt"("finalExamId", "userId", "attemptNumber");

-- CreateIndex
CREATE INDEX "FinalExamAnswer_questionId_idx" ON "FinalExamAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalExamAnswer_attemptId_questionId_key" ON "FinalExamAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "FinalExamRevalidation_finalExamId_userId_idx" ON "FinalExamRevalidation"("finalExamId", "userId");

-- CreateIndex
CREATE INDEX "FinalExamRevalidation_grantedById_idx" ON "FinalExamRevalidation"("grantedById");

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTest" ADD CONSTRAINT "LessonTest_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTestQuestion" ADD CONSTRAINT "LessonTestQuestion_lessonTestId_fkey" FOREIGN KEY ("lessonTestId") REFERENCES "LessonTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTestSubmission" ADD CONSTRAINT "LessonTestSubmission_lessonTestId_fkey" FOREIGN KEY ("lessonTestId") REFERENCES "LessonTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTestSubmission" ADD CONSTRAINT "LessonTestSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTestAnswer" ADD CONSTRAINT "LessonTestAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "LessonTestSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTestAnswer" ADD CONSTRAINT "LessonTestAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "LessonTestQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalExam" ADD CONSTRAINT "FinalExam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalExamQuestion" ADD CONSTRAINT "FinalExamQuestion_finalExamId_fkey" FOREIGN KEY ("finalExamId") REFERENCES "FinalExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalExamAttempt" ADD CONSTRAINT "FinalExamAttempt_finalExamId_fkey" FOREIGN KEY ("finalExamId") REFERENCES "FinalExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalExamAttempt" ADD CONSTRAINT "FinalExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalExamAttempt" ADD CONSTRAINT "FinalExamAttempt_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalExamAnswer" ADD CONSTRAINT "FinalExamAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "FinalExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalExamAnswer" ADD CONSTRAINT "FinalExamAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "FinalExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalExamRevalidation" ADD CONSTRAINT "FinalExamRevalidation_finalExamId_fkey" FOREIGN KEY ("finalExamId") REFERENCES "FinalExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalExamRevalidation" ADD CONSTRAINT "FinalExamRevalidation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalExamRevalidation" ADD CONSTRAINT "FinalExamRevalidation_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve legacy student completion when moving from module-level to lesson-level progress.
-- A completed module marks all of its lessons completed as of the legacy completion timestamp.
INSERT INTO "LessonProgress" ("id", "userId", "lessonId", "completedAt")
SELECT
    'legacy_lesson_progress_' || substr(md5(mp."userId" || ':' || l."id"), 1, 24),
    mp."userId",
    l."id",
    COALESCE(mp."completedAt", CURRENT_TIMESTAMP)
FROM "ModuleProgress" AS mp
INNER JOIN "Lesson" AS l ON l."moduleId" = mp."moduleId"
WHERE mp."completed" = true
ON CONFLICT ("userId", "lessonId") DO NOTHING;

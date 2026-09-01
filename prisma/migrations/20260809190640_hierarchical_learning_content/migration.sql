-- CreateEnum
CREATE TYPE "LearningScope" AS ENUM ('COURSE', 'MODULE', 'STYLE', 'LESSON');

-- CreateEnum
CREATE TYPE "AssessmentQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'WRITTEN', 'PHOTO', 'VIDEO');

-- CreateEnum
CREATE TYPE "AssessmentAttemptStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'NOT_PASSED');

-- CreateTable
CREATE TABLE "LearningResource" (
    "id" TEXT NOT NULL,
    "scope" "LearningScope" NOT NULL,
    "courseId" TEXT,
    "moduleId" TEXT,
    "styleId" TEXT,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "scope" "LearningScope" NOT NULL,
    "courseId" TEXT,
    "moduleId" TEXT,
    "styleId" TEXT,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isFinalExam" BOOLEAN NOT NULL DEFAULT false,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "publishedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentQuestion" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "type" "AssessmentQuestionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "options" JSONB,
    "correctAnswer" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAttempt" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "AssessmentAttemptStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "score" DOUBLE PRECISION,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "responseText" TEXT,
    "fileUrl" TEXT,
    "fileMimeType" TEXT,
    "isCorrect" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentRevalidation" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "attemptsGranted" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentRevalidation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningResource_courseId_order_idx" ON "LearningResource"("courseId", "order");

-- CreateIndex
CREATE INDEX "LearningResource_moduleId_order_idx" ON "LearningResource"("moduleId", "order");

-- CreateIndex
CREATE INDEX "LearningResource_styleId_order_idx" ON "LearningResource"("styleId", "order");

-- CreateIndex
CREATE INDEX "LearningResource_lessonId_order_idx" ON "LearningResource"("lessonId", "order");

-- CreateIndex
CREATE INDEX "Assessment_courseId_order_idx" ON "Assessment"("courseId", "order");

-- CreateIndex
CREATE INDEX "Assessment_moduleId_order_idx" ON "Assessment"("moduleId", "order");

-- CreateIndex
CREATE INDEX "Assessment_styleId_order_idx" ON "Assessment"("styleId", "order");

-- CreateIndex
CREATE INDEX "Assessment_lessonId_order_idx" ON "Assessment"("lessonId", "order");

-- CreateIndex
CREATE INDEX "AssessmentQuestion_assessmentId_order_idx" ON "AssessmentQuestion"("assessmentId", "order");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_assessmentId_userId_status_idx" ON "AssessmentAttempt"("assessmentId", "userId", "status");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_userId_status_idx" ON "AssessmentAttempt"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAttempt_assessmentId_userId_attemptNumber_key" ON "AssessmentAttempt"("assessmentId", "userId", "attemptNumber");

-- CreateIndex
CREATE INDEX "AssessmentAnswer_questionId_idx" ON "AssessmentAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAnswer_attemptId_questionId_key" ON "AssessmentAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "AssessmentRevalidation_assessmentId_userId_idx" ON "AssessmentRevalidation"("assessmentId", "userId");

-- CreateIndex
CREATE INDEX "AssessmentRevalidation_grantedById_idx" ON "AssessmentRevalidation"("grantedById");

-- AddForeignKey
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "ModuleStyle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "ModuleStyle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentRevalidation" ADD CONSTRAINT "AssessmentRevalidation_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentRevalidation" ADD CONSTRAINT "AssessmentRevalidation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentRevalidation" ADD CONSTRAINT "AssessmentRevalidation_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A resource or assessment belongs to exactly one context. Prisma cannot
-- express these cross-column checks, so keep the invariant at the database.
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_exactly_one_parent"
CHECK (
  ("scope" = 'COURSE' AND "courseId" IS NOT NULL AND "moduleId" IS NULL AND "styleId" IS NULL AND "lessonId" IS NULL) OR
  ("scope" = 'MODULE' AND "courseId" IS NULL AND "moduleId" IS NOT NULL AND "styleId" IS NULL AND "lessonId" IS NULL) OR
  ("scope" = 'STYLE' AND "courseId" IS NULL AND "moduleId" IS NULL AND "styleId" IS NOT NULL AND "lessonId" IS NULL) OR
  ("scope" = 'LESSON' AND "courseId" IS NULL AND "moduleId" IS NULL AND "styleId" IS NULL AND "lessonId" IS NOT NULL)
);

ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_exactly_one_parent"
CHECK (
  ("scope" = 'COURSE' AND "courseId" IS NOT NULL AND "moduleId" IS NULL AND "styleId" IS NULL AND "lessonId" IS NULL) OR
  ("scope" = 'MODULE' AND "courseId" IS NULL AND "moduleId" IS NOT NULL AND "styleId" IS NULL AND "lessonId" IS NULL) OR
  ("scope" = 'STYLE' AND "courseId" IS NULL AND "moduleId" IS NULL AND "styleId" IS NOT NULL AND "lessonId" IS NULL) OR
  ("scope" = 'LESSON' AND "courseId" IS NULL AND "moduleId" IS NULL AND "styleId" IS NULL AND "lessonId" IS NOT NULL)
);
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_configuration_valid"
CHECK (
  "maxAttempts" > 0 AND "passingScore" BETWEEN 0 AND 100 AND
  (NOT "isFinalExam" OR ("scope" = 'COURSE' AND "isRequired"))
);
ALTER TABLE "AssessmentRevalidation" ADD CONSTRAINT "AssessmentRevalidation_positive_attempts"
CHECK ("attemptsGranted" > 0);
CREATE UNIQUE INDEX "Assessment_one_final_per_course"
ON "Assessment" ("courseId") WHERE "isFinalExam" AND "courseId" IS NOT NULL;

-- Preserve current resources without modifying the legacy tables. New UI and
-- APIs read LearningResource; legacy routes can remain active during rollout.
INSERT INTO "LearningResource" (
  "id", "scope", "courseId", "title", "fileUrl", "fileType", "fileSize", "order", "createdAt", "updatedAt"
)
SELECT 'legacy-course-resource-' || "id", 'COURSE', "courseId", "title", "fileUrl", "fileType", "fileSize", "order", "createdAt", "createdAt"
FROM "CourseResource"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "LearningResource" (
  "id", "scope", "moduleId", "title", "fileUrl", "fileType", "fileSize", "order", "createdAt", "updatedAt"
)
SELECT 'legacy-module-resource-' || "id", 'MODULE', "moduleId", "title", "fileUrl", "fileType", "fileSize", "order", "createdAt", "createdAt"
FROM "ModuleResource"
ON CONFLICT ("id") DO NOTHING;

-- Every historic test/exam becomes a normal unified assessment. In
-- particular, historical final candidates intentionally start as non-final so
-- an administrator can explicitly select the one certifying exam per course.
INSERT INTO "Assessment" (
  "id", "scope", "moduleId", "title", "description", "order", "isRequired", "maxAttempts", "passingScore", "publishedAt", "createdAt", "updatedAt"
)
SELECT 'legacy-module-test-' || "id", 'MODULE', "moduleId", "title", "description", "order", "isRequired", GREATEST("maxAttempts", 1), "passingScore", "createdAt", "createdAt", "updatedAt"
FROM "ModuleTest"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Assessment" (
  "id", "scope", "courseId", "title", "description", "order", "isRequired", "isFinalExam", "maxAttempts", "passingScore", "publishedAt", "createdAt", "updatedAt"
)
SELECT 'legacy-course-test-' || "id", 'COURSE', "courseId", "title", "description", "order", "isRequired", false, GREATEST("maxAttempts", 1), "passingScore", "createdAt", "createdAt", "updatedAt"
FROM "CourseTest"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Assessment" (
  "id", "scope", "courseId", "title", "description", "order", "isRequired", "isFinalExam", "maxAttempts", "passingScore", "publishedAt", "createdAt", "updatedAt"
)
SELECT 'legacy-course-exam-' || "id", 'COURSE', "courseId", "title", "description", 0, true, false, 1, "passingScore", "createdAt", "createdAt", "updatedAt"
FROM "CourseExam"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "AssessmentQuestion" (
  "id", "assessmentId", "type", "title", "description", "order", "required", "options", "correctAnswer", "config", "createdAt", "updatedAt"
)
SELECT
  'legacy-question-' || q."id",
  CASE
    WHEN q."testId" IS NOT NULL THEN 'legacy-module-test-' || q."testId"
    WHEN q."courseTestId" IS NOT NULL THEN 'legacy-course-test-' || q."courseTestId"
    ELSE 'legacy-course-exam-' || q."examId"
  END,
  CASE
    WHEN q."type" = 'MULTIPLE_CHOICE' THEN 'MULTIPLE_CHOICE'::"AssessmentQuestionType"
    WHEN q."type" IN ('FILE_UPLOAD', 'PHOTO') THEN 'PHOTO'::"AssessmentQuestionType"
    WHEN q."type" = 'VIDEO' THEN 'VIDEO'::"AssessmentQuestionType"
    ELSE 'WRITTEN'::"AssessmentQuestionType"
  END,
  q."title", q."description", q."order", true,
  q."config" -> 'options', q."config" ->> 'correctAnswer', q."config", q."createdAt", q."createdAt"
FROM "Question" q
WHERE q."testId" IS NOT NULL OR q."courseTestId" IS NOT NULL OR q."examId" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "AssessmentAttempt" (
  "id", "assessmentId", "userId", "attemptNumber", "status", "score", "submittedAt"
)
SELECT
  'legacy-module-submission-' || s."id", 'legacy-module-test-' || s."testId", s."userId", s."attemptNumber",
  CASE WHEN s."isPassed" THEN 'APPROVED'::"AssessmentAttemptStatus" ELSE 'NOT_PASSED'::"AssessmentAttemptStatus" END,
  s."score", s."submittedAt"
FROM "ModuleSubmission" s
ON CONFLICT ("assessmentId", "userId", "attemptNumber") DO NOTHING;

INSERT INTO "AssessmentAttempt" (
  "id", "assessmentId", "userId", "attemptNumber", "status", "score", "submittedAt"
)
SELECT
  'legacy-course-test-submission-' || s."id", 'legacy-course-test-' || s."courseTestId", s."userId", s."attemptNumber",
  CASE
    WHEN s."isPassed" THEN 'APPROVED'::"AssessmentAttemptStatus"
    WHEN s."status" = 'PENDING' THEN 'PENDING_REVIEW'::"AssessmentAttemptStatus"
    ELSE 'NOT_PASSED'::"AssessmentAttemptStatus"
  END,
  s."score", s."submittedAt"
FROM "CourseTestSubmission" s
ON CONFLICT ("assessmentId", "userId", "attemptNumber") DO NOTHING;

INSERT INTO "AssessmentAttempt" (
  "id", "assessmentId", "userId", "attemptNumber", "status", "score", "reviewNote", "reviewedAt", "submittedAt"
)
SELECT
  'legacy-exam-submission-' || s."id", 'legacy-course-exam-' || s."examId", s."userId", 1,
  CASE
    WHEN s."isPassed" THEN 'APPROVED'::"AssessmentAttemptStatus"
    WHEN s."status" = 'PENDING' THEN 'PENDING_REVIEW'::"AssessmentAttemptStatus"
    ELSE 'NOT_PASSED'::"AssessmentAttemptStatus"
  END,
  s."score", s."reviewNote", s."reviewedAt", s."submittedAt"
FROM "ExamSubmission" s
ON CONFLICT ("assessmentId", "userId", "attemptNumber") DO NOTHING;

INSERT INTO "AssessmentAnswer" (
  "id", "attemptId", "questionId", "responseText", "isCorrect", "createdAt"
)
SELECT
  'legacy-question-submission-' || qs."id",
  CASE
    WHEN qs."submissionId" IS NOT NULL THEN 'legacy-module-submission-' || qs."submissionId"
    ELSE 'legacy-course-test-submission-' || qs."courseTestSubmissionId"
  END,
  'legacy-question-' || qs."questionId", qs."answer", qs."isCorrect", qs."createdAt"
FROM "QuestionSubmission" qs
WHERE qs."submissionId" IS NOT NULL OR qs."courseTestSubmissionId" IS NOT NULL
ON CONFLICT ("attemptId", "questionId") DO NOTHING;

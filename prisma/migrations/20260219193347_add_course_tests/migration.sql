-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "courseTestId" TEXT;

-- AlterTable
ALTER TABLE "QuestionSubmission" ADD COLUMN     "courseTestSubmissionId" TEXT;

-- CreateTable
CREATE TABLE "CourseTest" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isFinalExam" BOOLEAN NOT NULL DEFAULT false,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseTestSubmission" (
    "id" TEXT NOT NULL,
    "courseTestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "isPassed" BOOLEAN NOT NULL DEFAULT false,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseTestSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseTest_courseId_idx" ON "CourseTest"("courseId");

-- CreateIndex
CREATE INDEX "CourseTestSubmission_userId_courseTestId_idx" ON "CourseTestSubmission"("userId", "courseTestId");

-- CreateIndex
CREATE INDEX "CourseTestSubmission_courseTestId_idx" ON "CourseTestSubmission"("courseTestId");

-- CreateIndex
CREATE INDEX "CourseTestSubmission_status_idx" ON "CourseTestSubmission"("status");

-- CreateIndex
CREATE INDEX "Question_courseTestId_idx" ON "Question"("courseTestId");

-- CreateIndex
CREATE INDEX "QuestionSubmission_courseTestSubmissionId_idx" ON "QuestionSubmission"("courseTestSubmissionId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_courseTestId_fkey" FOREIGN KEY ("courseTestId") REFERENCES "CourseTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSubmission" ADD CONSTRAINT "QuestionSubmission_courseTestSubmissionId_fkey" FOREIGN KEY ("courseTestSubmissionId") REFERENCES "CourseTestSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTest" ADD CONSTRAINT "CourseTest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTestSubmission" ADD CONSTRAINT "CourseTestSubmission_courseTestId_fkey" FOREIGN KEY ("courseTestId") REFERENCES "CourseTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTestSubmission" ADD CONSTRAINT "CourseTestSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

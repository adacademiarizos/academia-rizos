-- CreateTable
CREATE TABLE "LessonTestRevalidation" (
    "id" TEXT NOT NULL,
    "lessonTestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "attemptsGranted" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonTestRevalidation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonTestRevalidation_lessonTestId_userId_idx" ON "LessonTestRevalidation"("lessonTestId", "userId");

-- CreateIndex
CREATE INDEX "LessonTestRevalidation_grantedById_idx" ON "LessonTestRevalidation"("grantedById");

-- AddForeignKey
ALTER TABLE "LessonTestRevalidation" ADD CONSTRAINT "LessonTestRevalidation_lessonTestId_fkey" FOREIGN KEY ("lessonTestId") REFERENCES "LessonTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTestRevalidation" ADD CONSTRAINT "LessonTestRevalidation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTestRevalidation" ADD CONSTRAINT "LessonTestRevalidation_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

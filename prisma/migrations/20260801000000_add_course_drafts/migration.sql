-- CreateTable
CREATE TABLE "CourseDraft" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseDraft_courseId_key" ON "CourseDraft"("courseId");

-- CreateIndex
CREATE INDEX "CourseDraft_updatedAt_idx" ON "CourseDraft"("updatedAt");

-- AddForeignKey
ALTER TABLE "CourseDraft" ADD CONSTRAINT "CourseDraft_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

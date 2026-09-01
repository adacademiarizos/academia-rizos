-- Courses can now use modules, styles, or two independent sections.
CREATE TYPE "CourseContentStructure" AS ENUM ('MODULES', 'STYLES', 'BOTH');

ALTER TABLE "Course" ADD COLUMN "contentStructure" "CourseContentStructure";

-- Videos are uploaded directly to R2. External URLs and transcriptions are no
-- longer part of the course-content model.
ALTER TABLE "Module"
  DROP COLUMN IF EXISTS "videoUrl",
  DROP COLUMN IF EXISTS "transcript";
ALTER TABLE "Lesson"
  DROP COLUMN IF EXISTS "videoUrl",
  DROP COLUMN IF EXISTS "transcript";

-- Modules become top-level course content. Keep their old style reference
-- temporarily so the legacy migration assistant can show where they came from.
DROP INDEX IF EXISTS "Module_styleId_order_key";
ALTER TABLE "Module" DROP CONSTRAINT IF EXISTS "Module_styleId_fkey";
ALTER TABLE "Module" ALTER COLUMN "styleId" DROP NOT NULL;
ALTER TABLE "Module" ADD CONSTRAINT "Module_styleId_fkey"
  FOREIGN KEY ("styleId") REFERENCES "ModuleStyle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing module orders were only unique within a style. Re-number them per
-- course before enforcing the new top-level uniqueness.
WITH ordered_modules AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "courseId" ORDER BY "order", "createdAt", "id"
  ) - 1 AS next_order
  FROM "Module"
)
UPDATE "Module" AS module
SET "order" = ordered_modules.next_order
FROM ordered_modules
WHERE module."id" = ordered_modules."id";
CREATE UNIQUE INDEX "Module_courseId_order_key" ON "Module"("courseId", "order");

-- A lesson now belongs directly to the course and either a module or a style.
ALTER TABLE "Lesson" ADD COLUMN "courseId" TEXT;
UPDATE "Lesson" AS lesson
SET "courseId" = module."courseId"
FROM "Module" AS module
WHERE lesson."moduleId" = module."id";
ALTER TABLE "Lesson" ALTER COLUMN "courseId" SET NOT NULL;
ALTER TABLE "Lesson" ALTER COLUMN "moduleId" DROP NOT NULL;
ALTER TABLE "Lesson" ALTER COLUMN "styleId" DROP NOT NULL;

-- Legacy lessons are preserved as module lessons. The old module.styleId is
-- retained until an administrator explicitly converts the course to styles.
UPDATE "Lesson" SET "styleId" = NULL WHERE "moduleId" IS NOT NULL;

ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_exactly_one_container_check"
  CHECK ((("moduleId" IS NOT NULL)::int + ("styleId" IS NOT NULL)::int) = 1);

DROP INDEX IF EXISTS "Lesson_moduleId_order_key";
CREATE UNIQUE INDEX "Lesson_moduleId_order_key" ON "Lesson"("moduleId", "order")
  WHERE "moduleId" IS NOT NULL;
CREATE UNIQUE INDEX "Lesson_styleId_order_key" ON "Lesson"("styleId", "order")
  WHERE "styleId" IS NOT NULL;
CREATE INDEX "Lesson_courseId_idx" ON "Lesson"("courseId");

CREATE TABLE "LessonProgress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LessonProgress_userId_lessonId_key" ON "LessonProgress"("userId", "lessonId");
CREATE INDEX "LessonProgress_lessonId_idx" ON "LessonProgress"("lessonId");
CREATE INDEX "LessonProgress_userId_idx" ON "LessonProgress"("userId");
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

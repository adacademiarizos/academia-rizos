-- The Prisma model had drifted from the table: it declared a `createdAt` that
-- does not exist, omitted the `completed` flag the style player writes, and
-- marked `completedAt` as required. These statements are defensive so an
-- environment that already matches is left untouched.
ALTER TABLE "LessonProgress" ADD COLUMN IF NOT EXISTS "completed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LessonProgress" ALTER COLUMN "completedAt" DROP NOT NULL;

-- Rows written before the flag existed represented completed lessons.
UPDATE "LessonProgress" SET "completed" = true WHERE "completed" = false AND "completedAt" IS NOT NULL;

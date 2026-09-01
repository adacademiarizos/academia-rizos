-- Bullets shown as "Lo que aprenderás" on the public course page.
ALTER TABLE "Course" ADD COLUMN "learningOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[];

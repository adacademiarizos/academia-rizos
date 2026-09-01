-- Multiple choice questions in the final exam.
-- The exam stays manually reviewed; options/correctAnswer let the reviewer see
-- at a glance whether the student picked the right one.
ALTER TYPE "FinalExamQuestionType" ADD VALUE IF NOT EXISTS 'MULTIPLE_CHOICE';

ALTER TABLE "FinalExamQuestion" ADD COLUMN IF NOT EXISTS "options" JSONB;
ALTER TABLE "FinalExamQuestion" ADD COLUMN IF NOT EXISTS "correctAnswer" TEXT;

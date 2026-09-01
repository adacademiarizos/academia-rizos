-- Active AI/transcription and course-authoring flows still read and write these
-- nullable compatibility fields. Restore them forward without rewriting the
-- historical migration that removed them.
ALTER TABLE "Module"
  ADD COLUMN IF NOT EXISTS "videoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "transcript" TEXT;

ALTER TABLE "Lesson"
  ADD COLUMN IF NOT EXISTS "videoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "transcript" TEXT;

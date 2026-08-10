-- Styles are a course-level branch, parallel to modules. Legacy automatically
-- created "general" styles are collapsed into direct module lessons; named
-- styles and their lessons are preserved as course-level style content.

ALTER TABLE "ModuleStyle" ADD COLUMN "courseId" TEXT;

UPDATE "ModuleStyle" AS style
SET "courseId" = module."courseId"
FROM "Module" AS module
WHERE style."moduleId" = module."id";

ALTER TABLE "LearningResource" DROP CONSTRAINT "LearningResource_exactly_one_parent";
ALTER TABLE "Assessment" DROP CONSTRAINT "Assessment_exactly_one_parent";
ALTER TABLE "Lesson" ALTER COLUMN "styleId" DROP NOT NULL;
ALTER TABLE "Lesson" ALTER COLUMN "moduleId" DROP NOT NULL;

-- The generated General style was only a former storage implementation for a
-- module's direct lessons. Keep those lessons and contextual content in the
-- module before removing the generated style record.
UPDATE "Lesson" AS lesson
SET "styleId" = NULL
FROM "ModuleStyle" AS style
WHERE lesson."styleId" = style."id" AND style."slug" = 'general';

UPDATE "LearningResource" AS resource
SET "scope" = 'MODULE', "moduleId" = style."moduleId", "styleId" = NULL
FROM "ModuleStyle" AS style
WHERE resource."scope" = 'STYLE' AND resource."styleId" = style."id" AND style."slug" = 'general';

UPDATE "Assessment" AS assessment
SET "scope" = 'MODULE', "moduleId" = style."moduleId", "styleId" = NULL
FROM "ModuleStyle" AS style
WHERE assessment."scope" = 'STYLE' AND assessment."styleId" = style."id" AND style."slug" = 'general';

-- Named styles become siblings of modules. Their lessons keep the style as
-- their only parent, so no module owns a style indirectly.
UPDATE "Lesson" AS lesson
SET "moduleId" = NULL
FROM "ModuleStyle" AS style
WHERE lesson."styleId" = style."id" AND style."slug" <> 'general';

DELETE FROM "ModuleStyle" WHERE "slug" = 'general';

DROP INDEX "Lesson_styleId_order_key";
CREATE UNIQUE INDEX "Lesson_moduleId_order_key" ON "Lesson"("moduleId", "order") WHERE "moduleId" IS NOT NULL;
CREATE UNIQUE INDEX "Lesson_styleId_order_key" ON "Lesson"("styleId", "order") WHERE "styleId" IS NOT NULL;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_exactly_one_parent"
CHECK (("moduleId" IS NOT NULL AND "styleId" IS NULL) OR ("moduleId" IS NULL AND "styleId" IS NOT NULL));

ALTER TABLE "ModuleStyle" DROP CONSTRAINT "ModuleStyle_moduleId_fkey";
DROP INDEX "ModuleStyle_moduleId_idx";
DROP INDEX "ModuleStyle_moduleId_order_idx";
DROP INDEX "ModuleStyle_moduleId_slug_key";
DROP INDEX "ModuleStyle_moduleId_order_key";
ALTER TABLE "ModuleStyle" DROP COLUMN "moduleId";
ALTER TABLE "ModuleStyle" ALTER COLUMN "courseId" SET NOT NULL;
CREATE INDEX "ModuleStyle_courseId_idx" ON "ModuleStyle"("courseId");
CREATE INDEX "ModuleStyle_courseId_order_idx" ON "ModuleStyle"("courseId", "order");
CREATE UNIQUE INDEX "ModuleStyle_courseId_slug_key" ON "ModuleStyle"("courseId", "slug");
CREATE UNIQUE INDEX "ModuleStyle_courseId_order_key" ON "ModuleStyle"("courseId", "order");
ALTER TABLE "ModuleStyle" ADD CONSTRAINT "ModuleStyle_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

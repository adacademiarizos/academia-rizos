-- Move styles from module-local sections to course-level containers.
-- Existing modules are assigned to the first style they had; any legacy lesson
-- sections are consolidated into that module so no lesson content is lost.

ALTER TABLE "ModuleStyle" ADD COLUMN "courseId" TEXT;
ALTER TABLE "Module" ADD COLUMN "styleId" TEXT;

UPDATE "ModuleStyle" AS style
SET "courseId" = module."courseId"
FROM "Module" AS module
WHERE style."moduleId" = module."id";

-- The old unique lesson order is scoped to a style. Remove it before merging
-- equal course-level style names from different modules.
DROP INDEX IF EXISTS "Lesson_styleId_order_key";

-- Reuse one course-level style for equal style names and reassign every lesson
-- to the canonical style. Module ownership remains on the lesson.
WITH ranked_styles AS (
  SELECT
    "id",
    FIRST_VALUE("id") OVER (
      PARTITION BY "courseId", "slug"
      ORDER BY "order", "createdAt", "id"
    ) AS canonical_id
  FROM "ModuleStyle"
)
UPDATE "Lesson" AS lesson
SET "styleId" = ranked_styles.canonical_id
FROM ranked_styles
WHERE lesson."styleId" = ranked_styles."id";

-- A module belongs to its first legacy style after deduplication.
WITH ranked_styles AS (
  SELECT
    "id",
    FIRST_VALUE("id") OVER (
      PARTITION BY "courseId", "slug"
      ORDER BY "order", "createdAt", "id"
    ) AS canonical_id
  FROM "ModuleStyle"
), first_module_style AS (
  SELECT DISTINCT ON (module."id")
    module."id" AS module_id,
    ranked_styles.canonical_id
  FROM "Module" AS module
  INNER JOIN "ModuleStyle" AS style ON style."moduleId" = module."id"
  INNER JOIN ranked_styles ON ranked_styles."id" = style."id"
  ORDER BY module."id", style."order", style."createdAt", style."id"
)
UPDATE "Module" AS module
SET "styleId" = first_module_style.canonical_id
FROM first_module_style
WHERE module."id" = first_module_style.module_id;

-- The previous migration created a General style for every module, so every
-- module has a value above. This guard makes a damaged legacy database fail
-- clearly instead of silently creating unclassified content.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Module" WHERE "styleId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate module without a legacy style';
  END IF;
END $$;

WITH ranked_styles AS (
  SELECT
    "id",
    FIRST_VALUE("id") OVER (
      PARTITION BY "courseId", "slug"
      ORDER BY "order", "createdAt", "id"
    ) AS canonical_id
  FROM "ModuleStyle"
)
DELETE FROM "ModuleStyle" AS style
USING ranked_styles
WHERE style."id" = ranked_styles."id"
  AND ranked_styles."id" <> ranked_styles.canonical_id;

-- Re-number styles and lessons for their new ownership scopes.
WITH ordered_styles AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "courseId"
    ORDER BY "order", "createdAt", "id"
  ) - 1 AS next_order
  FROM "ModuleStyle"
)
UPDATE "ModuleStyle" AS style
SET "order" = ordered_styles.next_order
FROM ordered_styles
WHERE style."id" = ordered_styles."id";

WITH ordered_lessons AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "moduleId"
    ORDER BY "order", "createdAt", "id"
  ) - 1 AS next_order
  FROM "Lesson"
)
UPDATE "Lesson" AS lesson
SET "order" = ordered_lessons.next_order
FROM ordered_lessons
WHERE lesson."id" = ordered_lessons."id";

ALTER TABLE "ModuleStyle" ALTER COLUMN "courseId" SET NOT NULL;
ALTER TABLE "Module" ALTER COLUMN "styleId" SET NOT NULL;

ALTER TABLE "ModuleStyle" DROP CONSTRAINT "ModuleStyle_moduleId_fkey";
DROP INDEX IF EXISTS "ModuleStyle_moduleId_idx";
DROP INDEX IF EXISTS "ModuleStyle_moduleId_order_idx";
DROP INDEX IF EXISTS "ModuleStyle_moduleId_slug_key";
DROP INDEX IF EXISTS "ModuleStyle_moduleId_order_key";
ALTER TABLE "ModuleStyle" DROP COLUMN "moduleId";

DROP INDEX IF EXISTS "Module_courseId_order_key";
DROP INDEX IF EXISTS "Lesson_styleId_order_key";

CREATE INDEX "ModuleStyle_courseId_idx" ON "ModuleStyle"("courseId");
CREATE INDEX "ModuleStyle_courseId_order_idx" ON "ModuleStyle"("courseId", "order");
CREATE UNIQUE INDEX "ModuleStyle_courseId_slug_key" ON "ModuleStyle"("courseId", "slug");
CREATE UNIQUE INDEX "ModuleStyle_courseId_order_key" ON "ModuleStyle"("courseId", "order");
CREATE INDEX "Module_styleId_idx" ON "Module"("styleId");
CREATE UNIQUE INDEX "Module_styleId_order_key" ON "Module"("styleId", "order");
CREATE UNIQUE INDEX "Lesson_moduleId_order_key" ON "Lesson"("moduleId", "order");

ALTER TABLE "ModuleStyle" ADD CONSTRAINT "ModuleStyle_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Module" ADD CONSTRAINT "Module_styleId_fkey"
  FOREIGN KEY ("styleId") REFERENCES "ModuleStyle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

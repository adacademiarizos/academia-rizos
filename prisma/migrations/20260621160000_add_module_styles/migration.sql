-- CreateTable
CREATE TABLE "ModuleStyle" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleStyle_pkey" PRIMARY KEY ("id")
);

-- Create one default style for every existing module.
INSERT INTO "ModuleStyle" ("id", "moduleId", "order", "name", "slug", "description", "isActive", "createdAt", "updatedAt")
SELECT
    'style_' || "Module"."id",
    "Module"."id",
    0,
    'General',
    'general',
    'Contenido migrado automaticamente desde lecciones directas de la seccion.',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Module";

-- Add canonical style reference to lessons and backfill it through the legacy moduleId.
ALTER TABLE "Lesson" ADD COLUMN "styleId" TEXT;

UPDATE "Lesson"
SET "styleId" = 'style_' || "moduleId"
WHERE "styleId" IS NULL;

ALTER TABLE "Lesson" ALTER COLUMN "styleId" SET NOT NULL;

-- Re-scope lesson ordering to styles.
DROP INDEX "Lesson_moduleId_order_key";

-- CreateIndex
CREATE INDEX "ModuleStyle_moduleId_idx" ON "ModuleStyle"("moduleId");

-- CreateIndex
CREATE INDEX "ModuleStyle_moduleId_order_idx" ON "ModuleStyle"("moduleId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleStyle_moduleId_slug_key" ON "ModuleStyle"("moduleId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleStyle_moduleId_order_key" ON "ModuleStyle"("moduleId", "order");

-- CreateIndex
CREATE INDEX "Lesson_styleId_idx" ON "Lesson"("styleId");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_styleId_order_key" ON "Lesson"("styleId", "order");

-- AddForeignKey
ALTER TABLE "ModuleStyle" ADD CONSTRAINT "ModuleStyle_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "ModuleStyle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

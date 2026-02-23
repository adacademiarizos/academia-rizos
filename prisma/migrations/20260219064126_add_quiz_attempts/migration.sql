-- DropIndex
DROP INDEX "ModuleSubmission_testId_userId_key";

-- AlterTable
ALTER TABLE "ModuleSubmission" ADD COLUMN     "attemptNumber" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ModuleTest" ADD COLUMN     "maxAttempts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "passingScore" INTEGER NOT NULL DEFAULT 70;

-- CreateIndex
CREATE INDEX "ModuleSubmission_userId_testId_idx" ON "ModuleSubmission"("userId", "testId");

-- CreateEnum
CREATE TYPE "BugType" AS ENUM ('CONTENT', 'FUNCTIONALITY');

-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "currency" SET DEFAULT 'EUR';

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "currency" SET DEFAULT 'EUR';

-- AlterTable
ALTER TABLE "PaymentLink" ADD COLUMN     "createdById" TEXT,
ALTER COLUMN "currency" SET DEFAULT 'EUR';

-- AlterTable
ALTER TABLE "ServiceStaffPrice" ALTER COLUMN "currency" SET DEFAULT 'EUR';

-- AlterTable
ALTER TABLE "Settings" ALTER COLUMN "defaultCurrency" SET DEFAULT 'EUR';

-- CreateTable
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "bugType" "BugType" NOT NULL,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BugReport_userId_idx" ON "BugReport"("userId");

-- CreateIndex
CREATE INDEX "BugReport_bugType_idx" ON "BugReport"("bugType");

-- CreateIndex
CREATE INDEX "PaymentLink_createdById_idx" ON "PaymentLink"("createdById");

-- AddForeignKey
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

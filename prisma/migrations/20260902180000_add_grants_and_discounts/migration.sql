-- How a student obtained a course, so a scholarship is distinguishable from a sale.
CREATE TYPE "CourseAccessSource" AS ENUM ('PURCHASE', 'GRANT', 'FREE');
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

ALTER TABLE "CourseAccess" ADD COLUMN "source" "CourseAccessSource" NOT NULL DEFAULT 'PURCHASE';
ALTER TABLE "CourseAccess" ADD COLUMN "grantedById" TEXT;
ALTER TABLE "CourseAccess" ADD COLUMN "grantNote" TEXT;

ALTER TABLE "CourseAccess" ADD CONSTRAINT "CourseAccess_grantedById_fkey"
    FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Redeemable discount codes.
CREATE TABLE "DiscountCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" "DiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "courseId" TEXT,
    "maxRedemptions" INTEGER,
    "redemptions" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");
CREATE INDEX "DiscountCode_courseId_idx" ON "DiscountCode"("courseId");
CREATE INDEX "DiscountCode_isActive_idx" ON "DiscountCode"("isActive");

ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One row per person per code: this unique index is what enforces one use each.
CREATE TABLE "DiscountRedemption" (
    "id" TEXT NOT NULL,
    "discountCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "amountOffCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscountRedemption_discountCodeId_userId_key" ON "DiscountRedemption"("discountCodeId", "userId");
CREATE INDEX "DiscountRedemption_userId_idx" ON "DiscountRedemption"("userId");

ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_discountCodeId_fkey"
    FOREIGN KEY ("discountCodeId") REFERENCES "DiscountCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

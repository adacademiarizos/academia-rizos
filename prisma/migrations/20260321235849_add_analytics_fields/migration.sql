-- AlterTable
ALTER TABLE "ConversionEvent" ADD COLUMN     "amountCents" INTEGER,
ADD COLUMN     "currency" TEXT DEFAULT 'EUR',
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT;

-- AlterTable
ALTER TABLE "PageView" ADD COLUMN     "browser" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "deviceType" TEXT,
ADD COLUMN     "os" TEXT,
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmContent" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT,
ADD COLUMN     "utmTerm" TEXT;

-- CreateIndex
CREATE INDEX "ConversionEvent_utmSource_idx" ON "ConversionEvent"("utmSource");

-- CreateIndex
CREATE INDEX "ConversionEvent_utmCampaign_idx" ON "ConversionEvent"("utmCampaign");

-- CreateIndex
CREATE INDEX "PageView_utmSource_idx" ON "PageView"("utmSource");

-- CreateIndex
CREATE INDEX "PageView_utmCampaign_idx" ON "PageView"("utmCampaign");

-- CreateIndex
CREATE INDEX "PageView_userId_idx" ON "PageView"("userId");

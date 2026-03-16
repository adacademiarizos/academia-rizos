/*
  Warnings:

  - You are about to drop the `BeforeAfterPair` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "BeforeAfterPair";

-- CreateTable
CREATE TABLE "ResultImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "aspectRatio" DOUBLE PRECISION NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultImage_pkey" PRIMARY KEY ("id")
);

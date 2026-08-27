-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationDeliveryChannel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "eventKey" TEXT,
ADD COLUMN "dedupeKey" TEXT,
ADD COLUMN "resourceType" TEXT,
ADD COLUMN "resourceId" TEXT,
ADD COLUMN "actionUrl" TEXT,
ADD COLUMN "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "readAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT,
    "recipientUserId" TEXT,
    "eventKey" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "channel" "NotificationDeliveryChannel" NOT NULL DEFAULT 'EMAIL',
    "recipientEmail" TEXT,
    "type" TEXT NOT NULL,
    "relatedId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "actionUrl" TEXT,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_resourceType_resourceId_idx" ON "Notification"("resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_channel_dedupeKey_key" ON "NotificationDelivery"("channel", "dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_recipientUserId_idx" ON "NotificationDelivery"("recipientUserId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_scheduledFor_idx" ON "NotificationDelivery"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "NotificationDelivery_resourceType_resourceId_status_idx" ON "NotificationDelivery"("resourceType", "resourceId", "status");

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

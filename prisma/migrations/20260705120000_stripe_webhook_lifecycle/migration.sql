-- Track Stripe webhook deliveries for idempotent processing.
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "payload" JSONB,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebhookEvent_stripeEventId_key" ON "WebhookEvent"("stripeEventId");
CREATE INDEX "WebhookEvent_type_idx" ON "WebhookEvent"("type");
CREATE INDEX "WebhookEvent_processedAt_idx" ON "WebhookEvent"("processedAt");

-- Preserve historical enrollments while allowing access revocation.
ALTER TABLE "CourseAccess" ADD COLUMN "revokedAt" TIMESTAMP(3);

CREATE INDEX "CourseAccess_revokedAt_idx" ON "CourseAccess"("revokedAt");

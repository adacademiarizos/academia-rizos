-- AlterTable
ALTER TABLE "ConversionEvent" ADD COLUMN "paymentId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "paidAt" TIMESTAMP(3);

-- Backfill one attributed event per payment before adding the unique constraint.
WITH ranked_events AS (
  SELECT
    id,
    "metadata"->>'paymentId' AS payment_id,
    ROW_NUMBER() OVER (
      PARTITION BY "metadata"->>'paymentId'
      ORDER BY "createdAt" ASC, id ASC
    ) AS row_number
  FROM "ConversionEvent"
  WHERE "metadata"->>'paymentId' IS NOT NULL
)
UPDATE "ConversionEvent" AS event
SET "paymentId" = ranked_events.payment_id
FROM ranked_events
WHERE event.id = ranked_events.id
  AND ranked_events.row_number = 1;

-- Only backfill confirmed payments with a deterministically attributed event.
UPDATE "Payment" AS payment
SET "paidAt" = event."createdAt"
FROM "ConversionEvent" AS event
WHERE event."paymentId" = payment.id
  AND payment.status = 'PAID'
  AND payment."paidAt" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ConversionEvent_paymentId_key" ON "ConversionEvent"("paymentId");

-- CreateIndex
CREATE INDEX "Payment_type_status_paidAt_idx" ON "Payment"("type", "status", "paidAt");

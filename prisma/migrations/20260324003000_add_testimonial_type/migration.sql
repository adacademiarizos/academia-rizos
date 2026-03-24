-- CreateEnum
CREATE TYPE "TestimonialType" AS ENUM ('SALON', 'ACADEMIA');

-- AlterTable
ALTER TABLE "Testimonial"
ADD COLUMN "type" "TestimonialType" NOT NULL DEFAULT 'SALON';

-- CreateIndex
CREATE INDEX "Testimonial_type_order_idx" ON "Testimonial"("type", "order");

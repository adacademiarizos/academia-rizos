-- Add the per-course text rendered on issued certificates.
ALTER TABLE "Course" ADD COLUMN "certificateSlogan" TEXT;

-- Courses without a certificate slogan remain drafts until an administrator
-- completes the required publishing information.
UPDATE "Course"
SET "isActive" = false
WHERE "certificateSlogan" IS NULL
   OR btrim("certificateSlogan") = '';

-- Destructive: drops Course.certificateSlogan. Irreversible in production; values
-- cannot be reconstructed from anything else (issued certificate PDFs render the
-- slogan as an image, not a queryable source). No UPDATE and no reactivation logic
-- here — dropping the column does NOT reactivate any course (owner-confirmed 2026-09-01).
ALTER TABLE "Course" DROP COLUMN "certificateSlogan";

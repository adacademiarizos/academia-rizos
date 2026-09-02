-- WS-D08 (owner-approved 2026-09-01): partial unique index on Certificate.
-- Prisma cannot express a partial unique index in schema.prisma, so this
-- migration is hand-written. Only one valid certificate may exist per
-- (userId, courseId) pair; invalid placeholders are excluded so the legacy
-- issuance flow (which briefly holds a valid:false placeholder alongside the
-- real certificate during approval) keeps working.
CREATE UNIQUE INDEX "Certificate_userId_courseId_valid_key" ON "Certificate"("userId", "courseId") WHERE "valid" = true;

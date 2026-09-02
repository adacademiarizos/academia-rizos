-- Collect the profile data a certificate depends on.
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "profileCompletedAt" TIMESTAMP(3);

-- Accounts created with a password typed their own name into the registration
-- form, so that name is already the one they chose: grandfather them in.
-- Accounts without a password came from an OAuth provider, which supplied
-- whatever name the provider had on file. Those are exactly the accounts whose
-- certificates can carry the wrong name, so they stay unconfirmed and are sent
-- through the onboarding step on their next visit.
UPDATE "User" SET "profileCompletedAt" = "createdAt" WHERE "password" IS NOT NULL;

# Course Certification Specification

## Purpose

Defines automatic certificate issuance on final-exam pass, the single-certificate-per-student-
per-course invariant across both the automatic and legacy manual issuance paths, and failure
handling for email delivery and missing certificate configuration.

## Requirements

### Requirement: Automatic Certificate Issuance on Final Exam Pass

When a student passes a course's final exam, the system MUST issue that student's certificate
and email it to the student automatically, without requiring any admin action.

#### Scenario: Passing the final exam issues and emails the certificate

- GIVEN a student submits a passing attempt on a course's final exam
- WHEN the attempt is recorded as passed
- THEN a certificate is issued for that student and course
- AND the certificate is emailed to the student
- AND no admin action was required to trigger issuance or delivery

### Requirement: Idempotent Certificate Issuance Across Both Paths

Certificate issuance MUST be idempotent per student and course. When both the automatic
final-exam path and the legacy manual approval path fire for the same student and the same
course, exactly one valid certificate MUST exist, regardless of which path fires first.

#### Scenario: Automatic issuance first, then legacy manual approval

- GIVEN a student has already received an automatically issued certificate for a course
- WHEN an admin later approves that same student's certificate through the legacy manual
  approval path for the same course
- THEN exactly one valid certificate exists for that student and course

#### Scenario: Legacy manual approval first, then automatic issuance

- GIVEN an admin has already approved a certificate for a student through the legacy manual
  approval path for a course
- WHEN that same student subsequently passes the same course's final exam and triggers
  automatic issuance
- THEN exactly one valid certificate exists for that student and course

### Requirement: Email Delivery Failure Isolation

A failure to send the certificate email MUST NOT roll back or invalidate an otherwise valid
issued certificate.

#### Scenario: Certificate remains valid when email delivery fails

- GIVEN a certificate has been successfully issued for a student and course
- WHEN sending the certificate email fails
- THEN the issued certificate remains valid and stored
- AND no rollback of the certificate issuance occurs

## REMOVED Requirements

### Requirement: Missing Certificate Configuration Fails Clearly

(Reason: `Course.certificateSlogan` is removed entirely per owner decision 2026-09-01. With no
slogan field, the `COURSE_CERTIFICATE_SLOGAN_MISSING` 409 error path becomes impossible and is
deleted along with the field.)
(Migration: The Prisma column is dropped in a destructive migration. The publication
validation rule (`certificateSloganSchema`, `normalizeCertificateSlogan`, the `isActive` guard
in `src/validators/course.schema.ts`) is deleted — course publication no longer requires or
reads a slogan. All slogan reads across `certificate.service.ts`,
`academy-assessment-service.ts`, `learning-content-service.ts`,
`scripts/regenerate-certificates.{ts,mjs}`, and `prisma/seed.ts` are deleted. The certificate
PDF template drops the specialization line (`docs/academy-certificate-template.md`,
`src/lib/pdf.ts`). `tests/course-certificate-slogan.test.ts` is deleted.

**Already-issued certificates**: RECOMMENDATION — leave historical PDFs untouched; do NOT
bulk-regenerate. The stored PDF bytes for certificates issued before this change already baked
in whichever slogan (or lack of one) existed at issuance time; regenerating them retroactively
changes a legal-artifact document that a student may have already downloaded, printed, or
shared, with no compensating benefit. This is a recommendation and NOT fully confirmed by the
owner — flag for explicit confirmation before `sdd-apply` deletes `scripts/regenerate-
certificates.*` or leaves them as manual, opt-in tooling for the rare case an admin wants to
regenerate a specific certificate.)

### Requirement: Certificate Layout Has No Specialization Line

(Previously: "Missing Certificate Configuration Fails Clearly" — removed; see REMOVED
Requirements. `Course.certificateSlogan` no longer exists, so certificate issuance can never
fail on a missing slogan.)

The certificate PDF template MUST render without a specialization/slogan line. No course
field feeds a specialization line into the certificate.

#### Scenario: Certificate renders without a specialization line

- GIVEN a student becomes eligible for a course's certificate
- WHEN the certificate PDF is generated
- THEN the rendered certificate contains no specialization/slogan line
- AND certificate issuance does not depend on any per-course slogan value

### Requirement: Synchronous Certificate Issuance on Admin Approval

When an admin approves a certificate through the legacy manual approval route, the system MUST
issue the certificate synchronously within that request/response cycle, calling the existing
idempotent `certificate.service` issuance logic. The retry cron job (`issueCertificate.job.ts`)
MUST remain in place only as a safety net for certificates that failed synchronous issuance; it
MUST NOT be the primary or only issuance path for admin approvals.

#### Scenario: Admin approval issues the certificate before the response returns

- GIVEN an admin approves a student's certificate through the manual approval route
- WHEN the approval request is processed
- THEN the certificate is issued before the response is returned to the admin
- AND the admin does not need to wait for a background job to see the issued certificate

#### Scenario: Retry job remains a safety net, not a duplicate issuance path

- GIVEN a certificate was already issued synchronously during admin approval
- WHEN the retry cron job later runs for that same student and course
- THEN no second certificate is created, because issuance is idempotent
- AND the retry job only acts on certificates that synchronous issuance did not successfully create

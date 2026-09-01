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

### Requirement: Missing Certificate Configuration Fails Clearly

A course that is missing its required certificate slogan MUST fail certificate issuance with a
clear, identifiable error. It MUST NOT issue a malformed certificate and MUST NOT fail
silently.

#### Scenario: Missing slogan produces an identifiable error

- GIVEN a course has no certificate slogan configured
- WHEN a student becomes eligible for that course's certificate
- THEN certificate issuance fails with a clear, identifiable error
- AND no malformed certificate is created
- AND the failure is not silent

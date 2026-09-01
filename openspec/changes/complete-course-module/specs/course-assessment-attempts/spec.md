# Course Assessment Attempts Specification

## Purpose

Defines the unified, admin-facing view and grant mechanism for students who have exhausted
their assessment attempts across the three parallel evaluation systems in a course
(course/module/style/lesson-scope assessments, lesson tests, and the final exam), and the
non-destructive semantics of raising a student's attempt cap.

## Requirements

### Requirement: Unified Blocked-Student Attempts View

The system MUST provide a single attempts surface per course that lists every student who
currently has zero remaining attempts and has not passed, aggregated across course-scoped,
module-scoped, style-scoped, and lesson-scoped assessments, lesson tests, and the final exam.
Each listed row MUST identify the student, the specific assessment, its type and scope,
attempts used, and the current attempt cap.

#### Scenario: Blocked students from all three systems appear together

- GIVEN a course has one student who exhausted a lesson-scoped assessment, one who exhausted a
  lesson test, and one who exhausted the final exam
- WHEN an admin opens the course's attempts view
- THEN all three students appear in the same list
- AND each row shows the student, the assessment type/scope, attempts used, and the cap

#### Scenario: Student with remaining attempts or a pass is excluded

- GIVEN a student has attempts remaining, or has already passed an assessment
- WHEN an admin opens the course's attempts view
- THEN that student's row for that assessment does not appear

### Requirement: Attempt Cap Grant Across All Three Systems

The system MUST allow an admin to grant a specified number of additional attempts to any
student listed in the attempts view, for any of the three assessment systems, including lesson
tests, which today have no grant mechanism. The effective attempt cap MUST equal the base
attempt limit plus the sum of all attempts granted to that student for that assessment.

#### Scenario: Granting attempts raises the effective cap

- GIVEN a student has used all attempts against a base cap of 3
- WHEN an admin grants 2 additional attempts
- THEN the student's effective cap becomes 5
- AND the student can submit up to 2 more attempts

#### Scenario: Lesson test grants work like the other two systems

- GIVEN a student exhausted a lesson test's attempts
- WHEN an admin grants additional attempts from the attempts view
- THEN the lesson test's effective cap increases by the granted amount
- AND the student is no longer blocked

### Requirement: Non-Destructive Grant Semantics

Granting additional attempts MUST only raise the effective attempt cap. It MUST NOT reset the
student's progress, MUST NOT discard a previously failed score, and MUST NOT delete any prior
submission.

#### Scenario: Granting attempts does not reset progress

- GIVEN a student has partial progress recorded on an assessment
- WHEN an admin grants additional attempts
- THEN the student's recorded progress remains unchanged after the grant

#### Scenario: Granting attempts does not discard a failed score

- GIVEN a student has a previously recorded failing score
- WHEN an admin grants additional attempts
- THEN the previously recorded failing score remains stored and visible after the grant

#### Scenario: Granting attempts does not delete prior submissions

- GIVEN a student has one or more prior submissions on record
- WHEN an admin grants additional attempts
- THEN every prior submission remains retrievable after the grant

### Requirement: Re-Blocking After Granted Attempts Are Exhausted

A student whose granted attempts are exhausted again MUST reappear on the blocked-student list.

#### Scenario: Student reappears after using up a grant

- GIVEN a student received a grant of 2 additional attempts and has now used both
- WHEN an admin opens the course's attempts view
- THEN the student appears again in the blocked-student list for that assessment

### Requirement: Grant Authorization

Only users who pass the platform's admin authorization guard MAY grant additional attempts.

#### Scenario: Unauthorized user cannot grant attempts

- GIVEN a user does not satisfy the admin authorization guard
- WHEN that user attempts to grant additional attempts to a student
- THEN the request is rejected
- AND no attempt cap is changed

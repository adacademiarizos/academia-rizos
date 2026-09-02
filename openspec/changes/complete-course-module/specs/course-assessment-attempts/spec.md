# Course Assessment Attempts Specification

## Purpose

Defines the unified, admin-facing view and grant mechanism for students who have exhausted
their assessment attempts across the three parallel evaluation systems in a course
(course/module/style/lesson-scope assessments, lesson tests, and the final exam), and the
non-destructive semantics of raising a student's attempt cap.

## Requirements

### Requirement: Per-Test Selection Drives the Blocked-Student View

(Previously: "Unified Blocked-Student Attempts View" — the view showed one combined,
whole-course list of every blocked student across every test at once. Amended per owner
decision 2026-09-01: the admin selects ONE test/exam at a time, and the view then lists only
the students blocked on that selected test/exam.)

The system MUST provide an attempts surface per course where an admin first selects a single
test/exam — a specific course-scoped, module-scoped, style-scoped, or lesson-scoped
assessment, a specific lesson test, or the final exam — from a list of the course's
tests/exams. After selection, the system MUST list every student who currently has zero
remaining attempts and has not passed **that selected test/exam only**. It MUST NOT render a
single combined list mixing students from multiple tests/exams before a selection is made.
Each listed row MUST identify the student, attempts used, and the current attempt cap for the
selected test/exam.

#### Scenario: Selecting one test shows only students blocked on it

- GIVEN a course has one student who exhausted a lesson-scoped assessment, one who exhausted a
  lesson test, and one who exhausted the final exam
- WHEN an admin selects the lesson-scoped assessment from the test list
- THEN only the student blocked on that lesson-scoped assessment appears
- AND the students blocked on the lesson test and the final exam do not appear

#### Scenario: Switching the selected test switches the list

- GIVEN an admin has selected a test and sees its blocked students
- WHEN the admin selects a different test/exam for the same course
- THEN the view now lists only the students blocked on the newly selected test/exam

#### Scenario: Student with remaining attempts or a pass is excluded

- GIVEN a student has attempts remaining, or has already passed the selected test/exam
- WHEN an admin views that test's blocked-student list
- THEN that student's row does not appear

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

### Requirement: Grant Notification via In-App and Email

When an admin grants additional attempts to a student, the system MUST notify that student
BOTH through an in-app notification AND by email. Neither channel alone satisfies this
requirement.

#### Scenario: Both channels fire on a successful grant

- GIVEN an admin grants additional attempts to a student for a blocked test/exam
- WHEN the grant is successfully recorded
- THEN an in-app notification is created for that student
- AND an email is sent to that student
- AND both notifications reference the specific test/exam the grant applies to

#### Scenario: Notification failure does not roll back the grant

- GIVEN an admin grants additional attempts to a student
- WHEN sending the email notification fails
- THEN the attempt cap increase remains in effect
- AND the failure does not roll back the granted attempts

### Requirement: Grant Authorization

Only users who pass the platform's admin authorization guard MAY grant additional attempts.

#### Scenario: Unauthorized user cannot grant attempts

- GIVEN a user does not satisfy the admin authorization guard
- WHEN that user attempts to grant additional attempts to a student
- THEN the request is rejected
- AND no attempt cap is changed

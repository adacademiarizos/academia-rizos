# Course Analytics Specification

## Purpose

Defines the per-course, admin-facing analytics presentation for STUDENT PROGRESS ONLY —
enrollments, per-module/per-lesson progress, completion, and drop-off — rendered inline within
the course's own admin view.

(Previously: this spec also covered marketing metrics, test-performance metrics, certificate
metrics, and revenue metrics in the same tab. Amended per owner decision 2026-09-01: this
capability is narrowed to student-progress analytics only. Marketing/traffic/revenue metrics,
test-performance metrics, and certificate metrics are OUT of scope for this change and are cut
from this spec — see REMOVED Requirements below.)

## Requirements

### Requirement: Inline Course-Scoped Progress Analytics Rendering

The course's analytics tab MUST render student-progress analytics for that specific course
inline within the tab. It MUST NOT navigate the admin away to a separate global analytics
panel.

#### Scenario: Admin views progress analytics without leaving the course

- GIVEN an admin is on a course's admin view
- WHEN the admin opens the analytics tab
- THEN student-progress metrics for that course render inline
- AND no navigation to a global analytics page occurs

### Requirement: Enrollment and Progress Metrics Coverage

The course's analytics tab MUST include the number of enrolled students, per-module progress,
and per-lesson progress for that course.

#### Scenario: Enrollment and progress reflect the selected course only

- GIVEN a course has enrolled students with recorded module and lesson progress
- WHEN an admin opens that course's analytics tab
- THEN the displayed enrollment count, per-module progress, and per-lesson progress reflect
  only that course's students

### Requirement: Drop-Off Measured as Last Lesson Reached

Student drop-off MUST be measured as the last lesson each student reached. The analytics tab
MUST surface, at minimum, a distribution of students by the last lesson they reached, so an
admin can identify where students stop progressing.

#### Scenario: Drop-off reflects last lesson reached, not another metric

- GIVEN students in a course have stopped progressing at different lessons
- WHEN an admin opens that course's analytics tab
- THEN the drop-off view groups students by the last lesson each one reached
- AND drop-off is not computed from time-on-page, session count, or any other proxy metric

### Requirement: Completion Rate Definition

Completion rate MUST be defined as the number of students who completed the course divided by
the number of students enrolled in the course. It MUST NOT be defined as lessons completed
divided by total lessons.

#### Scenario: Completion rate uses students, not lessons

- GIVEN a course has 10 enrolled students and 4 have completed the course
- WHEN an admin views the completion rate
- THEN the displayed completion rate is 40%, computed as completed students over enrolled
  students, regardless of how many individual lessons were completed across the cohort

### Requirement: Empty-State Handling

The analytics view MUST handle a course with zero enrolled students without dividing by zero,
crashing, or rendering a blank panel.

#### Scenario: Course with zero enrolled students

- GIVEN a course has zero enrolled students
- WHEN an admin opens that course's analytics tab
- THEN completion rate and other student-derived metrics render as zero or an explicit
  no-data indicator, not an error or a blank panel

## REMOVED Requirements

### Requirement: Marketing Metrics Coverage

(Reason: owner decision 2026-09-01 narrows this capability's scope to student progress only.
Marketing/traffic/revenue metrics are out of scope for this change.)
(Migration: None for this change. The proposal's `MarketingAnalyticsService.getCourseAnalytics`
course-scoped read path is not implemented under this capability. If marketing metrics are
wanted inline later, propose a separate change.)

### Requirement: Learning Metrics Coverage

(Reason: superseded by "Enrollment and Progress Metrics Coverage" and "Drop-Off Measured as
Last Lesson Reached." Average score, attempt counts, pass rate, and blocked-student count are
test-performance and certificate-adjacent metrics, which owner decision 2026-09-01 places out
of scope for this capability.)
(Migration: Test-performance data (attempt counts, pass rate, average score) remains available
through the `course-assessment-attempts` capability's per-test blocked-student view; it is not
duplicated here.)

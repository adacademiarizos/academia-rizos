# Course Analytics Specification

## Purpose

Defines the per-course, admin-facing analytics presentation combining marketing metrics
(traffic and revenue) and learning metrics (completion and assessment performance), rendered
inline within the course's own admin view.

## Requirements

### Requirement: Inline Course-Scoped Analytics Rendering

The course's analytics tab MUST render marketing and learning analytics for that specific
course inline within the tab. It MUST NOT navigate the admin away to a separate global
analytics panel.

#### Scenario: Admin views analytics without leaving the course

- GIVEN an admin is on a course's admin view
- WHEN the admin opens the analytics tab
- THEN marketing and learning metrics for that course render inline
- AND no navigation to a global analytics page occurs

### Requirement: Marketing Metrics Coverage

The course's marketing metrics MUST include page views, unique visitors, purchases, revenue by
currency, and conversion rate, scoped to that course.

#### Scenario: Marketing metrics reflect the selected course only

- GIVEN a course has recorded page views, visitors, purchases, and revenue
- WHEN an admin opens that course's analytics tab
- THEN the displayed page views, unique visitors, purchases, revenue by currency, and
  conversion rate reflect only that course's activity

### Requirement: Learning Metrics Coverage

The course's learning metrics MUST include completion rate, average score, attempt counts,
pass rate, and the count of students currently blocked with zero remaining attempts.

#### Scenario: Learning metrics reflect course-wide student performance

- GIVEN a course has enrolled students with recorded completions, scores, attempts, and
  pass/fail outcomes
- WHEN an admin opens that course's analytics tab
- THEN completion rate, average score, attempt counts, pass rate, and the blocked-student count
  are all displayed

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

The analytics view MUST handle a course with zero enrolled students and a course with zero
page views without dividing by zero, crashing, or rendering a blank panel.

#### Scenario: Course with zero enrolled students

- GIVEN a course has zero enrolled students
- WHEN an admin opens that course's analytics tab
- THEN completion rate and other student-derived metrics render as zero or an explicit
  no-data indicator, not an error or a blank panel

#### Scenario: Course with zero page views

- GIVEN a course has zero recorded page views
- WHEN an admin opens that course's analytics tab
- THEN marketing metrics render as zero, not an error or a blank panel

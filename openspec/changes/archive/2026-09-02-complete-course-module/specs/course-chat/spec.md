# Course Chat Specification

## Purpose

Defines default-open course chat behavior for admins and students, and per-course chat
navigation in the sidebar, respecting existing course-access rules.

## Requirements

### Requirement: Default-Open Course Chat for Admins

Course chat MUST be open by default in the admin course view, without requiring the admin to
take an extra action to open it.

#### Scenario: Admin sees chat already open

- GIVEN an admin navigates to a course's admin chat view
- WHEN the view renders
- THEN the course chat is already open and visible, with no additional click required

### Requirement: Default-Open Course Chat for Students

Course chat MUST be open by default in the student learn view, without requiring the student
to take an extra action to open it.

#### Scenario: Student sees chat already open

- GIVEN a student with active access navigates to a course's learn view
- WHEN the view renders
- THEN the course chat is already open and visible, with no additional click required

### Requirement: Sidebar Course Chat Navigation

The sidebar MUST show the general community chat entry AND one entry per course the current
user has access to, for both student and admin/staff roles.

#### Scenario: Student sees community plus their accessible courses

- GIVEN a student has active access to two courses
- WHEN the student views the sidebar
- THEN the sidebar shows the general community chat entry and exactly two course chat entries

#### Scenario: Admin sees community plus every course entry

- GIVEN an admin or staff user is viewing the sidebar
- WHEN the sidebar renders
- THEN it shows the general community chat entry and one entry per course the admin/staff
  user has access to

### Requirement: Course Chat Access Enforcement

Course chat access MUST respect the existing course-access check: a student without active
access to a course MUST NOT be able to read or post in that course's chat room. Admins MUST
bypass this restriction.

#### Scenario: Student without active access is denied

- GIVEN a student does not have active access to a course
- WHEN that student attempts to read or post in that course's chat room
- THEN the request is denied

#### Scenario: Admin bypasses the access check

- GIVEN an admin has no explicit enrollment in a course
- WHEN the admin reads or posts in that course's chat room
- THEN the request succeeds

### Requirement: Sidebar Behavior With No Accessible Courses

A user with zero accessible courses MUST still see the general community chat entry in the
sidebar, with no per-course entries.

#### Scenario: User with no course access sees only community chat

- GIVEN a user has no active access to any course
- WHEN that user views the sidebar
- THEN only the general community chat entry is shown, with zero course chat entries

# Proposal: Complete the Course Module

**Phase**: sdd-propose · **Change**: `complete-course-module` · **Store**: openspec
**Input**: `openspec/changes/complete-course-module/explore.md` (orchestrator-verified)
**Risk level**: Medium-High · **Migration**: Yes (one) · **Delivery**: exceeds the 800-line budget (see Size Forecast)

> Engram MCP unreachable this session (`uv_spawn`). This file is the persisted artifact for
> topic `sdd/complete-course-module/proposal`.

## Intent

### Business problem

The course module is 70% built but unusable end to end for the people who run it. Admins
cannot see how a course performs, cannot unblock a student who exhausted lesson-test
attempts, and cannot talk to a cohort without hunting for a floating button. Students have
no course-scoped conversation surface at all. Every one of these gaps currently resolves
through a manual, out-of-band support action by the owner.

### Outcomes

| Outcome | Today | After |
| --- | --- | --- |
| Admin sees how a course performs | Outbound link to global `/admin/analytics` | Inline per-course marketing **and** learning metrics |
| Admin unblocks a stuck student | Possible for `Assessment` and `FinalExam`; impossible for `LessonTest`; scattered across panels | One "Attempts" tab listing every blocked student across all three systems |
| Course conversation | Widget starts closed, admin-only, no sidebar entry | Chat opens by default for admins and students; sidebar lists community + one entry per accessible course |
| Certificate issuance | Two paths can mint a certificate; idempotency untested | Both paths preserved, idempotency proven by test |

### Current-state gap

Three parallel attempt systems (`Assessment`, `LessonTest`, `FinalExam`) enforce caps with
inconsistent logic; only two have a revalidation model. `academy-assessment-service.ts` — the
file this change modifies most — has **zero** test coverage under `strict_tdd: true`.

## Scope

### WS0 — Characterization test baseline (runs FIRST, blocks all others)

Strict TDD is on and the target service is untested. No behaviour changes until the current
behaviour is pinned down.

**Acceptance criteria**
- [ ] `src/server/services/__tests__/academy-assessment-service.test.ts` created, covering
      `submitLessonTest` attempt-cap enforcement (`LESSON_TEST_ATTEMPTS_EXHAUSTED`),
      `grantFinalExamRevalidation`, `reviewFinalExamAttempt`, and
      `COURSE_CERTIFICATE_SLOGAN_MISSING`.
- [ ] `src/server/services/__tests__/certificate-service.test.ts` created, covering
      `generateAndSaveCertificate` idempotency and the mail-failure `.catch(() => {})` guard.
- [ ] Existing `learning-content-service.test.ts` extended to cover
      `grantAssessmentRevalidation` and the `maxAttempts + SUM(attemptsGranted)` rule.
- [ ] All new tests pass against **unmodified** production code (`npm test`).

### WS1 — Unified attempts management

`LessonTest` is the only system with no revalidation path. Approach A from exploration: mirror
the proven `FinalExamRevalidation` pattern rather than migrating onto `Assessment`.

**Acceptance criteria**
- [ ] New Prisma model `LessonTestRevalidation` (`lessonTestId`, `userId`, `grantedById`,
      `attemptsGranted`, `reason`, `createdAt`) + migration, mirroring `FinalExamRevalidation`.
      FK columns explicitly indexed; unique-per-grant semantics match the existing two models.
- [ ] `grantLessonTestRevalidation` in `academy-assessment-service.ts`; `submitLessonTest` and
      `getStudentLessonTests` count `maxAttempts + SUM(attemptsGranted)`.
- [ ] New route `POST /api/admin/lessons/[lessonId]/tests/[testId]/revalidations`, guarded by
      `getAdminUser()`, Zod-parsed inline, errors mapped through `AcademyAssessmentError`.
- [ ] New **Attempts tab** in `CourseAdminTabs` aggregating every student with zero remaining
      attempts across `Assessment` (COURSE/MODULE/STYLE/LESSON), `LessonTest`, and `FinalExam`,
      with a grant action per row.
- [ ] Existing per-panel grant actions in `LearningContentManager` / `FinalExamManager` keep
      working unchanged.
- [ ] Granting raises the cap only; it never resets or deletes prior attempts or scores.

### WS2 — Per-course student-progress analytics **[AMENDED 2026-09-01]**

> Narrowed by owner decision 2026-09-01. Marketing/traffic/revenue metrics, test-performance
> metrics, and certificate metrics are OUT of scope for this change; see
> `specs/course-analytics/spec.md` REMOVED Requirements and design `D-05`. This supersedes
> owner decision **D1** below, which read "marketing metrics AND learning metrics".

**Acceptance criteria**
- [ ] Course-scoped endpoint `GET /api/admin/courses/[courseId]/analytics` — **no date-range
      parameters** — returning student-progress metrics only.
- [ ] New progress aggregation (written from scratch) returning enrolled students, per-module
      progress, per-lesson progress, completion rate (D6 definition), and drop-off as the last
      lesson each student reached.
- [ ] `MarketingAnalyticsService.getCourseAnalytics` is **NOT** widened with a `courseId`
      filter and `marketing-analytics-service.ts` is not modified at all.
- [ ] `analiticas` tab renders the progress panel inline with recharts; the outbound
      `/admin/analytics` link is removed. No 7/30/90-day presets.
- [ ] Empty state handled explicitly: a course with zero enrolled students and no progress
      renders zeroes or an explicit no-data indicator, not a crash or a blank panel.

### WS-D — Remove `Course.certificateSlogan` **[NEW 2026-09-01]**

**Acceptance criteria**
- [ ] Destructive migration drops the column; the migration contains `DROP COLUMN` and nothing
      else (no course reactivation `UPDATE` — see design `D-13`).
- [ ] Every reader removed across ~20 files, including `src/validators/course.schema.ts`
      (deleted), the publication guard, the three admin course forms, `course-draft.ts`, and
      the certificate PDF specialization line.
- [ ] `scripts/regenerate-certificates.{ts,mjs}` deleted. Already-issued certificate PDFs are
      NOT regenerated and keep their printed specialization line.
- [ ] The `COURSE_CERTIFICATE_SLOGAN_MISSING` 409 path no longer exists anywhere.
- [ ] A course with no slogan can be published; `npm run typecheck` and `npm run lint` pass.

### WS-E — Grant notification **[NEW 2026-09-01]**

**Acceptance criteria**
- [ ] Granting attempts notifies the student in-app **and** by email, reusing
      `dispatchNotification` — no parallel mail or notification mechanism.
- [ ] In-app notification is written synchronously; the email is durably queued as a
      `NotificationDelivery` row drained by `notification-delivery.job.ts`.
- [ ] A notification failure never rolls back the attempt-cap increase.

### WS3 — Course chat for students and admins

**Acceptance criteria**
- [ ] Shared message/upload/mention logic extracted from `ChatWidget` and `ChatPanel` into one
      hook before any behaviour change (they duplicate ~80% today).
- [ ] Course chat opens by default in the admin `CourseAdminTabs` chat tab **and** in
      `src/app/(marketing)/learn/[courseId]/page.tsx`.
- [ ] Sidebar shows the general community chat plus one entry per course the user can access,
      for both `STUDENT_NAV` and `STAFF_NAV`.
- [ ] New "my accessible courses" endpoint backing the sidebar, honouring
      `isCourseAccessActive` with admin bypass. Expired access removes the entry.

### WS4 — Certificate issuance hardening

**Acceptance criteria**
- [ ] Integration test proving that the legacy manual approve path
      (`POST /api/admin/certificates/[id]/approve`) and the automatic
      `FinalExamAttempt` → `generateAndSaveCertificate` path, fired in either order for the same
      user+course, produce exactly **one** `Certificate`.
- [ ] Both paths remain functional. No legacy model, route, or admin surface is removed.

## Non-Goals

| Non-goal | Reason |
| --- | --- |
| Migrating `LessonTest` onto `Assessment(scope=LESSON)` | Exploration Approach B: needs a data migration and touches student test-taking routes; far larger than the reported gap. **Record as a separate future consolidation change.** |
| Removing `ModuleTest` / `CourseTest` legacy models | Appear dead in the active admin flow but unconfirmed; deleting them is not required by any outcome here. |
| Retiring the legacy manual certificate approval path | Owner decision: older courses predate `FinalExam`; zero risk of breaking them is the goal. |
| Deduplicating the three attempt systems into one | Symptom is addressed by the unified Attempts tab; the root duplication is deferred. |
| Changing payment, booking, or billing logic | Analytics reads revenue/purchase data only; it writes nothing. |

## Capabilities

### New Capabilities
- `course-assessment-attempts`: attempt caps, revalidation grants, and the unified blocked-student view across `Assessment`, `LessonTest`, and `FinalExam`.
- `course-analytics`: per-course marketing and learning metrics aggregation and admin presentation.
- `course-chat`: course-scoped chat rooms, default-open behaviour, and per-course sidebar navigation for students and admins.
- `course-certification`: final-exam-driven and manually-approved certificate issuance, with the single-certificate-per-user-per-course invariant.

### Modified Capabilities
- None. `openspec/specs/` is currently empty; all four are new full specs.

## Approach

Approach A from exploration. Additive parity with patterns already proven twice in this
codebase, plus test coverage first.

1. **Tests before behaviour.** WS0 pins current behaviour; every later workstream extends that
   suite before changing code.
2. **Mirror, don't unify.** `LessonTestRevalidation` copies `FinalExamRevalidation` exactly.
   One additive table, no data migration, no student-facing route changes.
3. **Aggregate at the read layer.** The unified Attempts tab and the analytics panel are new
   read-side aggregations over existing tables; no writes are relocated.
4. **Extract before toggling.** The chat hook extraction happens before flipping default-open,
   so the fix lands once instead of twice.
5. **Layering held.** Services own all Prisma access; routes stay thin with inline Zod and
   central error mapping.

## Affected Areas

| Area | Impact | Description |
| --- | --- | --- |
| `prisma/schema.prisma` + new migration | New | `LessonTestRevalidation` model |
| `src/server/services/academy-assessment-service.ts` | Modified | `grantLessonTestRevalidation`; attempt counting includes granted revalidations |
| `src/server/services/learning-content-service.ts` | Modified | Blocked-student aggregation feeding the Attempts tab |
| `src/server/services/marketing-analytics-service.ts` | Modified | Course-scoped read path |
| New learning-analytics aggregation | New | Completion, average score, attempts, pass rate, blocked count |
| `src/app/api/admin/lessons/[lessonId]/tests/[testId]/revalidations/route.ts` | New | Grant endpoint |
| `src/app/api/admin/courses/[courseId]/analytics/route.ts` | New | Course-scoped analytics |
| "My accessible courses" endpoint | New | Backs the sidebar chat entries |
| `CourseAdminTabs.tsx` | Modified | New Attempts tab; inline analytics; chat default-open |
| `ChatWidget.tsx` / `ChatPanel.tsx` / new shared hook | Modified/New | Deduplicate, then default-open |
| `Sidebar.tsx` | Modified | Per-course chat entries for `STUDENT_NAV` and `STAFF_NAV` |
| `src/app/(marketing)/learn/[courseId]/page.tsx` | Modified | Student course chat, open by default |
| `src/server/services/__tests__/*` | New | Characterization + integration suites |

## Test Strategy

`strict_tdd: true`. `academy-assessment-service.ts` has **zero** coverage today, so
characterization/unit tests for existing attempt, revalidation, and certificate-issuance logic
come **first**, before any behaviour change, and must pass against unmodified production code.

| File | Layer | Covers |
| --- | --- | --- |
| `src/server/services/__tests__/academy-assessment-service.test.ts` | unit (new) | Attempt caps, `grantFinalExamRevalidation`, `reviewFinalExamAttempt`, slogan error |
| `src/server/services/__tests__/certificate-service.test.ts` | unit (new) | `generateAndSaveCertificate` idempotency, mail-failure guard |
| `src/server/services/__tests__/learning-content-service.test.ts` | unit (extend) | `grantAssessmentRevalidation`, `maxAttempts + SUM(attemptsGranted)` |
| `src/server/services/__tests__/lesson-test-revalidation.test.ts` | unit (new) | New grant fn and updated counting |
| `src/server/services/__tests__/course-learning-analytics.test.ts` | unit (new) | Learning aggregation incl. empty-course case |
| `src/app/api/admin/courses/__tests__/course-attempts.integration.test.ts` | integration (new) | Attempts tab aggregation + grant route (template: `course-structure-integrity.integration.test.ts`) |
| `src/app/api/admin/certificates/__tests__/dual-issuance.integration.test.ts` | integration (new) | Both issuance paths → exactly one `Certificate` |

**Commands**: `npm test` (unit) · `npm run test:db:setup` then `npm run test:integration`
(integration) · `npm run typecheck && npm run lint` (gate).

## Size Forecast

| Workstream | Est. changed lines | Migration |
| --- | ---: | --- |
| WS0 — characterization tests | ~350 | No |
| WS1 — unified attempts + `LessonTestRevalidation` | ~550 | **Yes** |
| WS2 — analytics (marketing + learning) | ~400 | No |
| WS3 — chat + sidebar (incl. hook extraction) | ~350 | No |
| WS4 — certificate hardening (tests only) | ~150 | No |
| **Total** | **~1800** | |

> **SUPERSEDED 2026-09-01.** The amended scope revises this to **~2420 lines** across seven
> workstreams (WS0–WS4 plus WS-D and WS-E) and adds an irreversible `DROP COLUMN`. The
> authoritative breakdown is `design.md` §13. `size:exception` (D5) was accepted at ~1800, not
> at ~2420 — surface the revised number to the owner before apply.

**Decision needed before apply: Yes**
**Chained PRs recommended: Yes**
**800-line budget risk: High**

The delivery strategy is `single-pr` with an 800-line review budget. **~1800 estimated lines is
roughly 2.25× that budget.** The owner must either accept a `size:exception` or approve a split
before `sdd-tasks` plans work units.

**Recommended split boundary** (four chained PRs on `feature/*` → `dev`, each independently
verifiable and revertible):

| PR | Content | Est. lines |
| --- | --- | ---: |
| 1 | WS0 + WS4 — all characterization and dual-issuance tests, **zero production change** | ~500 |
| 2 | WS1 — migration, model, service, route, Attempts tab | ~550 |
| 3 | WS2 — analytics endpoint + inline panel | ~400 |
| 4 | WS3 — chat hook extraction, default-open, sidebar | ~350 |

PR 1 is the natural first slice: it is pure test coverage, carries no production risk, and is a
strict TDD prerequisite for PRs 2–4.

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Dual certificate issuance creates a duplicate `Certificate` | Medium | High (student-facing, legal artifact) | WS4 integration test asserting exactly one certificate for both firing orders; both paths preserved |
| Zero existing coverage on `academy-assessment-service.ts` | Certain | High | WS0 blocks all behaviour change; tests must pass against unmodified code |
| Three parallel attempt systems drift further | High | Medium | Unified read-side Attempts tab; consolidation recorded as an explicit non-goal/future change |
| `ChatWidget` / `ChatPanel` ~80% logic duplication | High | Medium | Extract the shared hook **before** toggling default-open |
| Uncommitted working-tree baseline may shift before apply | Medium | Medium | Re-verify the affected files at the start of `sdd-apply`; treat exploration line numbers as indicative |
| Prisma migration applied to production | Low | High | Additive-only table, no backfill, no column drops; rollback plan below |
| Analytics course attribution depends on the `/courses/{courseId}` path shape | Medium | Low | Keep the existing `split_part` parsing untouched; document the coupling in the spec |
| Change exceeds the 800-line review budget | Certain | Medium | Explicit split boundary above; owner decision before `sdd-tasks` |

**Config rule check**: this change touches **auth-adjacent** logic (course-access checks for
chat/sidebar visibility) and **reads** payment data (revenue, purchases) for analytics. It
performs no payment, booking, or billing **mutation**. Flagged Medium-High rather than High for
that reason; treat the access-check changes in WS3 as the highest-scrutiny review area.

## Rollback Plan

**Per workstream** (each PR reverts independently):

| Slice | Rollback |
| --- | --- |
| PR 1 (tests) | `git revert` the commit. No production behaviour is affected. |
| PR 3 (analytics) | Revert the route + panel commit; the `analiticas` tab falls back to the outbound link. No data change. |
| PR 4 (chat) | Revert the hook + sidebar commit; the widget returns to `useState(false)` and the single "Comunidad" entry. No data change. |

**PR 2 — Prisma migration (the only schema change):**

1. The migration is **purely additive**: `CREATE TABLE lesson_test_revalidation` plus its FK
   indexes. No column drop, no type change, no backfill, no data rewrite.
2. Application rollback alone is safe: reverting the code leaves an unused, empty-or-populated
   table. `submitLessonTest` returns to counting `maxAttempts` only, so students who received
   a grant lose the extra attempts but no attempt history or score is lost.
3. Schema rollback, if required, is a new forward migration dropping the table
   (`DROP TABLE lesson_test_revalidation`) — never a hand-edit of an applied migration file.
   Take a DB backup first; the table holds admin grant decisions that cannot be reconstructed.
4. Verify on staging before `main`. `feature/*` → `dev` → `staging` → `main`.

## Dependencies

- `npm run test:db:setup` (Postgres `elizabeth_test`) must succeed before integration tests.
- `AGENT.md` constraint: **Plan Mode plus explicit human approval before any production code
  change**, and the `feature/*` → `dev` → `staging` → `main` branching model with **no direct
  pushes** to protected branches.
- Owner decision on the size exception vs. the four-PR split, required before `sdd-tasks`.

## Success Criteria

- [ ] An admin can unblock a student on a `LessonTest`, an `Assessment`, or a `FinalExam` from
      one Attempts tab, and granting raises the cap without resetting progress.
- [ ] The `analiticas` tab renders marketing and learning metrics for that course inline, with
      a clean zero state.
- [ ] Course chat opens by default for both admins and students, and both roles see community
      plus one sidebar entry per accessible course.
- [ ] An integration test proves both certificate paths yield exactly one `Certificate`, and no
      legacy certificate surface was removed.
- [ ] `npm test`, `npm run test:integration`, `npm run typecheck`, and `npm run lint` all pass.
- [ ] Each delivered PR stays within the agreed review budget or carries a recorded
      `size:exception`.

## Owner Decisions (recorded 2026-08-31)

These were decided by the product owner during the interactive proposal round and are FIXED
inputs for `sdd-spec`, `sdd-design`, `sdd-tasks`, and `sdd-apply`. They override any
contradicting assumption earlier in this document.

| # | Decision | Resolution |
| --- | --- | --- |
| D1 | Analytics scope | ~~Marketing metrics AND learning metrics.~~ **SUPERSEDED 2026-09-01: student-progress metrics ONLY** (enrollments, per-module/per-lesson progress, completion rate, drop-off as last lesson reached). See amended WS2. |
| D2 | Certificate issuance paths | Keep BOTH the automatic final-exam path and the legacy manual approval path. Harden with tests proving idempotency; retire nothing. |
| D3 | Chat audience | Both students and admins. Course chat opens by default in the admin course view and the student learn view. Sidebar shows the general chat plus one entry per accessible course, for both roles. |
| D4 | Attempts surface | ~~One unified attempts tab aggregating every blocked student across all three systems at once.~~ **AMENDED 2026-09-01: the tab remains the single surface, but the admin selects ONE test/exam first and then sees only that test's blocked students.** The selector still spans `Assessment` (all scopes), `LessonTest`, and `FinalExam`. Existing per-panel grant actions may remain. See design `D-02`/`D-02b`. |
| D5 | Delivery size | **`size:exception` ACCEPTED.** The owner was shown the ~1800-line forecast against the 800-line budget and the recommended 4-PR split, and explicitly chose a single PR. `delivery_strategy` becomes `exception-ok`. Do NOT split into chained PRs. |
| D6 | Completion rate definition | Students who completed the course divided by students enrolled. NOT lessons-completed-over-total. |
| D7 | Grant-attempt semantics | Granting additional attempts ONLY raises the attempt cap. It never resets progress, never discards a previous failed score, and never deletes prior submissions. This matches the existing `Assessment` and `FinalExam` behaviour and must stay consistent across all three systems. |

### Still open (non-blocking; resolve in `sdd-design`)

- Analytics date range: expose a range picker in the course panel, or default to a fixed
  window? The marketing aggregation already takes `{ from, to }`.
- Average score: pooled across all assessment systems, or reported per system?
- Sidebar scale: for a student with many courses, are per-course chat entries flat,
  collapsed under a group, or capped with a "see all"?
- Legacy `ModuleTest` / `CourseTest`: assumed dead and left untouched. Confirm no route
  still reaches them before apply.

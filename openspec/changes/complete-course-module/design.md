# Design: Complete the Course Module

**Phase**: sdd-design · **Change**: `complete-course-module` · **Store**: openspec
**Inputs**: `proposal.md` (Owner Decisions D1–D7 are FIXED), `explore.md`, `openspec/project-context.md`,
`specs/course-{assessment-attempts,analytics,certification,chat}/spec.md` (amended 2026-09-01)
**Delivery**: `exception-ok` — ONE PR, owner-accepted (D5). Revised size: **~2420 lines** (see §13).

> **AMENDED 2026-09-01.** The delta specs were revised after this design was first written.
> Amended sections are marked **[AMENDED 2026-09-01]**. Everything unmarked still holds
> unchanged. See §2b for the amendment log and the superseded-decision map.

---

## 1. Technical Approach

**[AMENDED 2026-09-01]** Additive read-side surfaces plus one additive table and one partial
unique index — **plus one destructive column drop** (WS-D, new). The change is no longer
"additive-only": `Course.certificateSlogan` is removed.

| Workstream | Strategy |
| --- | --- |
| WS0 tests | Characterization first, against unmodified production code. Blocks WS1–WS4. |
| WS1 attempts | Mirror `FinalExamRevalidation` into `LessonTestRevalidation`; **[AMENDED]** a selector lists the course's tests/exams and a scoped query returns the blocked students for the ONE selected test. |
| WS2 analytics | **[AMENDED]** Progress-only. New learning-progress service (Prisma aggregates + one in-memory sequence fold for last-lesson-reached). Marketing aggregation and the `MarketingAnalyticsService` widening are CUT. |
| WS3 chat | Extract the data layer into a hook, then add an opt-in `defaultOpen` prop; new "my courses" endpoint feeds a collapsed sidebar group. **Unchanged.** |
| WS4 certificate | **[AMENDED]** Tests **plus** the partial unique index (WS-D08, owner-approved) **plus** synchronous issuance semantics on admin approval (D-12). |
| **WS-D slogan removal** (new) | Destructive migration dropping `Course.certificateSlogan`, plus removal of every read, validator, form field, PDF line, and test across ~20 files. Historical PDFs are NOT regenerated. |
| **WS-E grant notification** (new) | Reuse `dispatchNotification` (in-app now, email queued) from the three grant service functions. No new mechanism. |

**Layering held**: services own all Prisma access; routes stay thin with inline Zod, `getAdminUser()`
guards, and central custom-error mapping; admin panels are client components with `fetch` + local state.

---

## 2. Exploration corrections (verified this phase)

Three exploration claims were wrong or incomplete. They change scope; treat this section as
authoritative over `explore.md`.

| Claim in `explore.md` | Verified reality | Impact |
| --- | --- | --- |
| "no `ChatWidget` in `src/app/(marketing)/learn/[courseId]/page.tsx`" | **False.** `ChatWidget` is mounted at `learn/[courseId]/page.tsx:115`, and also at `components/academy/LearningUnitPlayer.tsx:264`. A full-page course chat already exists at `learn/[courseId]/chat/page.tsx` using `ChatPanel`. | Students already have per-course chat. WS3 shrinks to default-open + sidebar. Sidebar links reuse the existing `/learn/{id}/chat` page — no new page. |
| "`ModuleTest` / `CourseTest` appear dead" | **False.** 36 files reference them. Live proof: `learn/[courseId]/page.tsx:17,18,63` renders `courseTests`; `api/modules/[moduleId]/progress/route.ts:75-102` gates module completion on `moduleTest`/`moduleSubmission`, and `:20-24` reads `courseTest`/`courseExam` before minting a placeholder certificate. | They stay untouched, and the Attempts tab + learning analytics **explicitly exclude** them with a visible UI note. Recorded as a follow-up change. |
| "certificate idempotency should prevent duplicates" | Sequentially yes; **concurrently no.** `certificate.service.ts` does `findFirst` (:24) → PDF generate → R2 upload → `create` (:67). The window is seconds wide and there is no unique constraint on `(userId, courseId)`. | See D-08. Not fixed in this PR, for a reason that is itself a design finding. |

---

## 2b. Amendment log — 2026-09-01 **[AMENDED]**

| Spec change | Design decision superseded | Replacement |
| --- | --- | --- |
| Per-test selection drives the blocked-student view | **D-02** (one whole-course combined list) | **D-02 (rewritten)** + **D-02b** selector |
| Analytics narrowed to student progress only | **D-05** (marketing + learning metrics), **D-06**, **D-09** | **D-05 (rewritten)**, **D-11** last-lesson-reached. D-06 and D-09 **withdrawn** |
| Synchronous certificate issuance on admin approval | — (new) | **D-12** |
| `Course.certificateSlogan` removed entirely | — (new) | **D-13** |
| Grant notification via in-app and email | — (new) | **D-14** |
| Partial unique index on `Certificate` | D-08 "defer" → owner override "fix now" | **unchanged, still valid** (§12 owner row) |

**Still binding, do not reopen**: D-01, D-03, D-04, D-07, D-08 owner override, D-10, and the
whole of §4 (data model), §6.1's grant half, §10, §11 steps 1–2.

**Withdrawn**: D-06 (per-system average score) and D-09 (7/30/90-day presets) are dropped with
the metrics they served. If marketing metrics return in a later change, both must be
re-decided from scratch — do not resurrect them from this file.

---

## 3. Architecture Decisions

### D-01 — `LessonTestRevalidation`: mirror, do not unify

| | |
| --- | --- |
| **Choice** | New model mirroring `FinalExamRevalidation` field-for-field. No unique constraint on `(lessonTestId, userId)` — grants accumulate and are summed. |
| **Rejected** | (a) Migrate `LessonTest` onto `Assessment(scope=LESSON)` — needs a data migration and touches student test-taking routes (proposal non-goal). (b) A generic polymorphic `Revalidation(targetType, targetId)` table — loses FK integrity and cascade behaviour, which is the only thing the two existing tables get right. |
| **Rationale** | Third instance of a pattern proven twice. Additive-only, so rollback is a forward `DROP TABLE`. A unique constraint would contradict D7: multiple grants must sum, exactly as `_sum.attemptsGranted` already does for the other two. |

**Deliberate deviation from the `postgresql` skill**: the skill prefers `snake_case`, `timestamptz`,
and `BIGINT GENERATED ALWAYS AS IDENTITY`. This table uses Prisma defaults — quoted `PascalCase`,
`TEXT` cuid PK, `TIMESTAMP(3)` — because Prisma owns the DDL and `prisma migrate diff` compares
against ~50 sibling tables built that way. A single divergent table would produce permanent drift
noise and a mixed-type schema, which is a larger hazard than the timezone nuance on an audit-only
grant timestamp. Where the skill does apply and is followed: **all three FK columns get explicit
indexes** (PostgreSQL does not auto-index FKs), `NOT NULL` on every semantically required column,
and explicit `ON DELETE` on every constraint.

### D-02 — Scoped blocked-students query for ONE selected test **[AMENDED 2026-09-01]**

Supersedes the original D-02, which returned one combined whole-course list from
`listBlockedStudents(courseId)`. The spec now requires the admin to select a single test/exam
first and see only that test's blocked students, and forbids rendering a combined list before
a selection is made.

| | |
| --- | --- |
| **Choice** | Same file `src/server/services/course-attempts-service.ts`, two functions instead of one: `listCourseAttemptTargets(courseId)` (D-02b) and `listBlockedStudentsForTarget(courseId, system, targetId): Promise<BlockedAttemptRow[]>`. The `BlockedAttemptRow` shape, the D-04 cap formula, and the `grantEndpoint`-per-system dispatch are **kept verbatim** — only the query scope narrows from "all targets in the course" to "one target". |
| **Rejected** | (a) Keep `listBlockedStudents(courseId)` and filter client-side by the selected target. (b) Three separate per-system service functions the panel picks between. |
| **Rationale** | (a) still pays the whole-course aggregation cost on every open and still ships the full cross-test student/email set to the browser, which is the privacy surface §10 already flags — the spec's intent is that the admin sees one test at a time, and fetching everything to hide most of it contradicts it. (b) reintroduces three call sites for one predicate, exactly what the original D-02 rejected. Keeping one service with a `system` discriminator preserves the single home for the cap formula while making the query scope a parameter. `courseId` stays in the signature as an **authorization argument**: the service verifies the target actually belongs to that course before reading attempts, so a target id from another course cannot be probed through the course-scoped admin route. |

**Query cost — it goes DOWN.** Old design: a fixed **~13 queries** on every tab open, over
`IN` lists spanning every assessment and lesson test in the course. New design:

| Interaction | Queries | Note |
| --- | --- | --- |
| Open the tab (selector only) | **3** | one `assessment.findMany` over the course/module/style/lesson scopes, one `lessonTest.findMany` via `lesson.courseId`, one `finalExam.findUnique`. Titles and `maxAttempts` only — no attempt data. |
| Select a test | **4** | ownership/target load, `attempt.groupBy(userId)` for `_count` + `_max`, passed-set `findMany`, `revalidation.groupBy(userId) _sum`. |
| Switch test | **4** | selector is already loaded; no refetch. |
| Grant + refetch | **4** | rescopes to the same target. |

Worst realistic session (open + inspect three tests) is `3 + 12 = 15` versus `13`, but the
common case (open + inspect one test) is **7 versus 13**, and every one of the four scoped
queries filters on a single `targetId` equality against an existing composite index rather
than an `IN` list of tens. Per-row work drops by roughly the number of targets in the course.
The naive-N+1 trap §9 describes is avoided identically — grouping still happens in the
database, and the student lookup is still one `user.findMany({ id: { in: blockedUserIds } })`
issued last.

### D-02b — Target selector spans canonical and legacy systems **[AMENDED 2026-09-01]**

| | |
| --- | --- |
| **Choice** | `listCourseAttemptTargets(courseId): Promise<AttemptTarget[]>` returns one flat, ordered list mixing all three systems, each entry carrying `system`, `targetId`, `title`, `scopeLabel`, and `baseMaxAttempts`. Rendered as a `<select>`/list in `CourseAttemptsPanel`, grouped by `scopeLabel` with the final exam pinned last. No target is pre-selected: the panel opens on an explicit "select a test" empty state, which is what the spec's "MUST NOT render a single combined list before a selection" requires. |
| **Rejected** | (a) Three separate selectors, one per system. (b) A two-step selector (pick system → pick test). |
| **Rationale** | The admin thinks in "which test", not "which of the three internal attempt systems" — those three systems are an implementation accident this change is explicitly not consolidating (proposal non-goal). Surfacing them as three controls would leak that accident into the UI and make "the lesson test for Lesson 3" harder to find than it is today. One list with a scope label per row keeps the legacy/canonical split invisible while `system` still drives `grantEndpoint`, so D-03's three-endpoint dispatch survives untouched. `ModuleTest`/`CourseTest` remain excluded (§2) with the same visible UI note. |

### D-03 — Three grant endpoints, not one polymorphic endpoint

| | |
| --- | --- |
| **Choice** | Keep `POST /api/admin/assessments/[assessmentId]/revalidations` and `POST /api/admin/courses/[courseId]/final-exam/revalidations` unchanged. Add exactly one: `POST /api/admin/lessons/[lessonId]/tests/[testId]/revalidations`. The Attempts tab dispatches on `row.system` using the `grantEndpoint` string the service already computed. |
| **Rejected** | A polymorphic `POST /api/admin/courses/[courseId]/attempts/grants` with `{ system, targetId, userId }`. |
| **Rationale** | The proposal requires the existing per-panel grant actions in `LearningContentManager` and `FinalExamManager` to keep working, so a polymorphic endpoint would be a **fourth** surface, not a replacement — strictly more code. It would also have to reimplement two different guard shapes (`getAdminUser()` for the final exam vs. the scope-aware guard for assessments) inside one switch. Three narrow endpoints and one client-side map is less total surface and no new auth logic. **Revisit if a fourth attempt system appears.** |

### D-04 — Effective cap and blocked predicate, unified

One formula, applied identically in all three systems and in both the service and the UI:

```
attemptsAllowed = target.maxAttempts + Σ revalidations.attemptsGranted   // for (target, user)
blocked         = attemptsUsed >= attemptsAllowed AND NOT passed
```

`passed` per system: `Assessment` → any attempt `status = APPROVED`; `LessonTest` → any submission
`isPassed = true`; `FinalExam` → any attempt `status = APPROVED`.

`grantLessonTestRevalidation` mirrors `grantFinalExamRevalidation`'s precondition, with one
documented translation: the final exam requires the latest attempt to be `NOT_PASSED` (it is manually
reviewed and can sit `PENDING_REVIEW`); a lesson test is auto-scored, so the equivalent is "latest
submission exists and `isPassed = false`". Same intent, no `PENDING_REVIEW` state to wait on.

### D-05 — Progress-only analytics, Prisma aggregates, not raw SQL **[AMENDED 2026-09-01]**

Supersedes the original D-05. The spec narrows this capability to student progress:
enrollments, per-module and per-lesson progress, completion rate, and drop-off. Marketing,
test-performance, and certificate metrics are cut.

| | |
| --- | --- |
| **Choice** | New `src/server/services/course-progress-analytics-service.ts` (renamed from `course-learning-analytics-service.ts` — "learning analytics" now overpromises) using `count` / `groupBy`, plus one in-memory fold for D-11. **`MarketingAnalyticsService` is not touched at all**: no `courseId` widening, no new parameter, no new call site. |
| **Rejected** | (a) Keep the marketing half behind a flag. (b) Widen `getCourseAnalytics` now and leave it unused for a later change. |
| **Rationale** | Both rejected options ship dead or unreachable code into a PR already carrying an accepted `size:exception`, and (b) widens a signature that has exactly one caller today with no consumer to validate the widening against. Cutting the widening entirely also removes the `split_part("path", '/', 3)` course-attribution coupling from this change's risk surface (proposal risk row) — it stays a pre-existing marketing concern. Prisma over raw SQL for the same reason as before: these are plain counts over indexed FK columns, so raw SQL would trade type safety for nothing. |

**Metric definitions** (D6 remains binding on completion rate):

| Metric | Definition | Note |
| --- | --- | --- |
| `enrolledStudents` | `CourseAccess` count with `buildActiveCourseAccessWhere()` | unchanged, reuses the existing helper |
| `completedStudents` | distinct users with a **valid** `Certificate` for the course | unchanged; caveat below still applies |
| `completionRate` | `completedStudents / enrolledStudents`, `0` when enrolled is `0` | **D6 stands**: students-over-students, NOT lessons-over-total |
| `modules[]` | per module: `{ moduleId, title, order, completedStudents }` from `moduleProgress.groupBy(moduleId)` | one query for the whole course |
| `lessons[]` | per lesson: `{ lessonId, title, sequenceIndex, reachedStudents, completedStudents }` | one query, see D-11 |
| `dropOff[]` | students bucketed by their last reached lesson | **D-11**, computed from the same `lessons[]` fold |

**Cut** from the previous version: `averageScore`, `attempts`, `passRate`, `blockedStudents`,
and every marketing field. Test-performance data now lives only in the
`course-assessment-attempts` per-test view (spec migration note). This also removes the
original D-05's cross-dependency on `listBlockedStudents(courseId)` — which is convenient,
because D-02 just deleted that function.

**Completion caveat, must still surface in the UI**: completion is read from issued
certificates because that is the only single row meaning "finished this course" for *both*
issuance paths. A course with no final exam and no certificate flow reports `0`, labelled
"según certificados emitidos". The rejected alternative — recomputing
`getCourseLearningProgress` per student — is exactly the N+1 that already makes
`/api/admin/courses/[courseId]/students` slow (`students/route.ts:34-52`, ~4 queries × N).

**Time semantics — all progress metrics are LIFETIME and unwindowed.** With marketing gone,
nothing in this panel takes `{ from, to }`, so the endpoint no longer accepts date parameters
at all (`GET /api/admin/courses/[courseId]/analytics`, no query string). Concretely: a student
who enrolled two years ago and reached lesson 4 last week counts in `enrolledStudents`, in
lesson 4's `reachedStudents`, and in the drop-off bucket for lesson 4 — permanently, until
their access is revoked or they progress further. Enrollment counts reflect *currently active*
access (`buildActiveCourseAccessWhere()`), so a student whose access expired disappears from
every metric at once, numerator and denominator together. This is deliberate and is the reason
D-09's presets are withdrawn: windowing cumulative progress makes the completion rate move for
reasons the admin cannot explain.

### D-06 — **WITHDRAWN 2026-09-01**

Average score is no longer reported by this capability, so there is nothing to pool or split.
The original rationale (`FinalExamAttempt` has no score column, so pooling is a category error)
is preserved here because it remains true and will be needed if test-performance metrics are
proposed again.

### D-07 — Chat: extract the data hook first, keep presentation duplicated

| | |
| --- | --- |
| **Choice** | Extract `useChatRoom(roomId)` into `src/app/components/useChatRoom.ts` — messages state, 3s polling, image upload, send, mention token, error/loading. Then add `defaultOpen?: boolean` to `ChatWidget`. Presentation JSX stays separate. |
| **Rejected** | (a) `defaultOpen` with no refactor. (b) Unify both components into one variant-driven component. |
| **Rationale** | The hook is ~90 net-new lines but deletes ~110 duplicated lines from the two components, so it is roughly **size-neutral** against the accepted `size:exception` — and it is the difference between fixing polling/scroll once instead of twice. The drift is already real: `ChatPanel` has `isAtBottomRef` scroll anchoring (`ChatPanel.tsx:57,101-106`) that `ChatWidget` lacks. (b) is rejected because a 320px fixed floating panel and a full-height column are genuinely different layouts; merging them produces a variant mega-component that is worse than the duplication. `ChatWidget` also resolves `roomId` from `courseId` while `ChatPanel` receives it as a prop — that resolution stays in `ChatWidget` as a second tiny hook, `useCourseChatRoom(courseId)`. |

`defaultOpen` is **opt-in per call site**, defaulting to `false`:

| Call site | `defaultOpen` | Why |
| --- | --- | --- |
| `CourseAdminTabs.tsx:98` (chat tab) | `true` | D3 |
| `learn/[courseId]/page.tsx:115` | `true` | D3 |
| `LearningUnitPlayer.tsx:264` | `false` (unchanged) | It is a video player. A 460px panel over the video is a regression, and D3 names only the course view. |

### D-08 — Certificate: prove the sequential invariant, defer the concurrent fix

| | |
| --- | --- |
| **Choice** | No production change. Integration test proves exactly one `Certificate` for both firing orders. The concurrency race is recorded as a known defect with a named follow-up and an `it.todo` in the suite. |
| **Rejected** | Adding `@@unique([userId, courseId])` in this PR. |
| **Rationale** | A **plain** unique constraint would break the working legacy path. `api/modules/[moduleId]/progress/route.ts:30-38` creates a `valid: false` placeholder, and `api/admin/certificates/[id]/approve/route.ts:69-70` generates the real certificate **before** deleting that placeholder — so two rows legitimately share `(userId, courseId)` for the duration of the approve call. The correct fix is a **partial** unique index, `CREATE UNIQUE INDEX ... ON "Certificate"("userId","courseId") WHERE "valid" = true`, which Prisma cannot express in `schema.prisma` and needs a hand-written migration plus a drift story. That is a second migration with its own shape, in a PR already at 2.25× budget. Deferring it is a scope call, not an oversight — and the race requires two admins approving inside the PDF-generation window, so likelihood is low while the cost of getting the constraint wrong is a broken legacy path. |

**If the owner wants it in this PR**, the design is: partial unique index in a second additive
migration, `create` wrapped in a `P2002` catch that re-reads and returns the winner, and a
concurrent-issuance integration test. That is ~80 more lines and a second rollback surface.

### D-09 — **WITHDRAWN 2026-09-01**

The 7/30/90-day presets served the marketing metrics only; the learning half was already
lifetime by the same decision. With marketing cut, the presets have nothing to window, so they
are removed rather than left as inert controls. `parseAnalyticsDateRange` is not imported by
the new panel and the analytics route takes no `from`/`to`. Time semantics are restated in
full in D-05.

### D-10 — Sidebar: collapsed group, capped at 8, with admin bypass parity

| | |
| --- | --- |
| **Choice** | One "Chats de curso" row that expands to the list. Capped at 8 visible with a "Ver todos" link. Hidden entirely when empty. Collapsed by default. |
| **Rejected** | (a) A flat list of every course. (b) A hard cap with no expansion. |
| **Rationale** | `Sidebar.tsx:153` puts `<nav>` in `overflow-y-auto` inside a fixed 280px column that also holds `NotificationsNavItem` and the account footer. A flat list is fine at 1–3 courses and silently pushes Notificaciones and "Cerrar sesión" out of reach at 10+. Collapsed-by-default costs one `useState` and preserves the exact current sidebar height for every existing user. |

The backing endpoint mirrors the **admin bypass already in `api/chat/rooms/[courseId]/route.ts:45-59`**
so the sidebar never shows an entry the room endpoint would reject, and never hides one it would allow:

| Role | Query |
| --- | --- |
| `STUDENT` / `STAFF` | `courseAccess.findMany({ where: { userId, ...buildActiveCourseAccessWhere() }, select: { course: { select: { id, title } } } })` |
| `ADMIN` | `course.findMany({ where: { isActive: true }, select: { id, title } })` |

Client-side it is a `CourseChatNavItems` sub-component doing `fetch` in `useEffect` — the pattern
`NotificationsNavItem` (`Sidebar.tsx:64-104`) already establishes. **No polling**: course access does
not change mid-session in a way worth a 30s interval. Entries link to the existing
`/learn/{courseId}/chat` page, so no new page is created. `MobileDrawer` (`nav: NavItem[]`) needs the
group too, or mobile silently loses it — one extra prop.

### D-11 — Last lesson reached: one course sequence, one fold, two queries **[NEW 2026-09-01]**

The spec requires drop-off measured as the last lesson each student reached, surfaced as a
distribution. Nothing in the schema stores this; it must be derived.

**"Reached" is row presence, "completed" is the flag.** `LessonProgress` has a documented
comment (`schema.prisma:633-635`) that the row existing is *not* completion, because the style
player toggles `completed` back and forth — a row means the student opened that lesson. That
is exactly the semantics drop-off needs, and it is why `reachedStudents` and
`completedStudents` are reported as two different numbers per lesson.

**The course has no stored global lesson order.** `Lesson.order` is scoped, not course-unique,
and `Lesson.moduleId` is nullable, so a canonical sequence must be built:

```
sequence = [
  ...modules sorted by Module.order          // @@unique([courseId, order]) — total order
     .flatMap(m => m.lessons sorted by Lesson.order),
  ...course lessons where moduleId === null sorted by Lesson.order,   // appended last
]
sequenceIndex = position in that array        // 0-based, assigned in memory
```

Module-less lessons are appended **last**, not interleaved: they have no defensible position
relative to module content, and putting them at the end means an unattached lesson can only
ever be the *final* drop-off bucket instead of silently shifting every other bucket. The panel
labels that group so the admin can see it.

| | |
| --- | --- |
| **Choice** | Two queries, then one in-memory fold. (1) `module.findMany({ where: { courseId }, include: { lessons } })` plus the module-less lessons — the course structure. (2) `lessonProgress.findMany({ where: { lesson: { courseId } }, select: { userId, lessonId, completed } })`. Then group rows by `userId`, take `max(sequenceIndex)` per user, and bucket. Restricted to users who currently hold active `CourseAccess`, so drop-off and `enrolledStudents` share one denominator. |
| **Rejected** | (a) `$queryRaw` with `DISTINCT ON (userId) ... ORDER BY sequenceIndex DESC`. (b) `lessonProgress.groupBy({ by: ['userId'], _max: { lessonId } })`. (c) A denormalized `CourseAccess.lastLessonId` column maintained on write. |
| **Rationale** | (b) is **wrong, not merely slow**: `_max` on a `cuid` string returns the lexicographically largest id, which has no relationship to lesson order — a plausible-looking query that silently produces garbage. (a) is correct but needs the sequence materialized in SQL via a `CASE`/`VALUES` join built from application data, which is more fragile than the fold and unindexable either way. (c) is a write-path change in a change whose whole approach is "aggregate at the read layer", and it would need a backfill. The fold's cost is `O(progress rows for this course)` in memory — bounded by `students × lessons`, both tens-to-hundreds for this platform, on an admin-only page. If a course ever outgrows that, (a) is the documented upgrade path. |

**Indexes**: `LessonProgress @@index([lessonId])` already covers the `lesson: { courseId }`
filter through `Lesson @@index([courseId])`; no new index is needed.

**Edge cases the unit test must pin**: a student with zero `LessonProgress` rows is counted in
`enrolledStudents` and bucketed as "no ha empezado" (a distinct bucket, **not** lesson 0); a
course with zero lessons returns an empty `lessons[]` and an empty `dropOff[]` without
throwing; a progress row pointing at a lesson deleted since is impossible (`onDelete: Cascade`)
but the fold still skips unknown `lessonId`s defensively rather than indexing `undefined`.

### D-12 — Synchronous issuance on admin approval; the cron stays a net **[NEW 2026-09-01]**

**Verified: the approve route already issues synchronously.**
`api/admin/certificates/[id]/approve/route.ts:69` calls `generateAndSaveCertificate` inline and
awaits it before responding, and `maxDuration = 60` is already set for the PDF+R2 round trip.
The spec's requirement is therefore **already satisfied by the current code**; this decision
records the semantics rather than changing the mechanism, and the only production edits WS4
makes here are D-13's slogan-guard deletion and the WS-D08 index.

| | |
| --- | --- |
| **Choice** | Keep synchronous issuance exactly as it is. Do not move issuance into the job, do not enqueue, do not add an optimistic response. Formalize the failure contract below and pin it with tests. |
| **Rejected** | (a) Enqueue a `NotificationDelivery`-style job row and return 202. (b) Fire-and-forget the issuance and let the cron always finish the work. |
| **Rationale** | Both make the admin wait for a cron tick to learn whether a legal artifact exists, which is the failure the spec names. The existing route is already the shape the spec asks for; changing it would be churn against an accepted size exception. |

**Failure semantics, precisely:**

| Failure point | Does approval commit? | What the admin sees | Cron behaviour |
| --- | --- | --- | --- |
| PDF generation throws (`generateCertificatePdf`) | **No.** The `Certificate` row is created *after* the PDF and the R2 upload (`certificate.service.ts:51-76`), so nothing is written. The `valid: false` placeholder is **not** deleted — `delete` is at `:70`, after issuance returns. | `502` with the existing message: "No se pudo emitir el certificado. El pendiente sigue disponible para reintentar." The pending row stays in the admin list and the button can be pressed again. | `issueCertificateJob` re-derives the candidate from the APPROVED attempt/submission, finds no `valid: true` certificate, and retries `generateAndSaveCertificate` (`issueCertificate.job.ts:107-129`). Its per-candidate `try/catch` means one bad course cannot stall the rest. |
| R2 upload throws (`uploadFile`) | **No.** Same window, same rollback-by-ordering. | Same `502`. | Same retry. |
| `certificate.create` throws | **No.** | Same `502`. | Same retry. |
| **Email send fails** (`sendCertificateEmail`) | **Yes.** The certificate is already created and valid. | `200` — the admin sees success, because the certificate genuinely exists and is downloadable. | Nothing. The cron skips it (a `valid: true` certificate exists), and it must: re-issuing to fix an email would mint a second PDF. |
| **In-app notification fails** | **Yes**, same as email. | `200`. | Nothing. |

The last two rows are the existing `.catch(() => {})` guards at `certificate.service.ts:86,104`
and are **required by the spec's "Email Delivery Failure Isolation" requirement** — they are
not sloppiness and must not be "fixed" into rethrows. The asymmetry is deliberate: PDF/R2/DB
failures mean *no artifact exists*, so the admin must know; delivery failures mean *the
artifact exists and can be downloaded from the certificates list*, so blocking approval on
them would be worse. Email retry is the mail layer's problem, not the approval's.

**The cron is idempotent by construction and stays**: it re-checks `valid: true` before every
issuance (`:109-120`) *and* `generateAndSaveCertificate` re-checks again (`:24-27`). With the
WS-D08 partial unique index in place, even a concurrent cron tick and admin approval collapse
to one row. That is precisely the spec's "retry job remains a safety net, not a duplicate
issuance path" scenario, and the WS4 integration test asserts it directly.

### D-13 — `Course.certificateSlogan` removal: destructive drop, no PDF regeneration **[NEW 2026-09-01]**

The blast radius is larger than the spec's file list. Verified by grep, **~20 files** read or
write this column, including three admin UI forms and the course-draft pipeline that the spec
does not mention. All of them must land in the same commit or `npm run typecheck` fails.

| | |
| --- | --- |
| **Choice** | One destructive migration `ALTER TABLE "Course" DROP COLUMN "certificateSlogan";`, plus removal of every reader in one sweep. `generateCertificatePdf` loses the `certificateSlogan` parameter entirely (not defaulted to `''`), and the `.specialization` div and its CSS rule are deleted from the template. |
| **Rejected** | (a) Deprecate: keep the column, stop reading it. (b) Keep the parameter optional in `generateCertificatePdf`. |
| **Rationale** | (a) leaves a column that the next person must re-investigate, and leaves the publication guard's *data* in place to tempt a re-read. (b) leaves an empty `<div class="specialization">` in the rendered PDF and a dead branch — if the line is gone from the design, the type should make passing one impossible. The migration is genuinely destructive and irreversible: it is the reason this change stops being additive-only, and §11 gains a mandatory pre-migration backup step. |

**Removal map** (all Modify unless stated):

| File | What goes |
| --- | --- |
| `prisma/schema.prisma:475` | `certificateSlogan String?` |
| `prisma/migrations/<ts>_drop_certificate_slogan/migration.sql` | **Create** — the `DROP COLUMN` |
| `src/validators/course.schema.ts` | `certificateSloganSchema`, `CERTIFICATE_SLOGAN_MAX_LENGTH`, `normalizeCertificateSlogan`, `getCoursePublicationError`. The file becomes empty of exports — **delete it** and drop the four import sites. |
| `src/server/services/certificate.service.ts:6,34,42-45,54` | slogan select, guard, and PDF argument |
| `src/server/services/academy-assessment-service.ts:7,696-700` | the whole `COURSE_CERTIFICATE_SLOGAN_MISSING` 409 block |
| `src/server/services/learning-content-service.ts:9,635-641` | the second `COURSE_CERTIFICATE_SLOGAN_MISSING` block |
| `src/app/api/admin/certificates/[id]/approve/route.ts:5,50-63` | the third slogan 409 — **the only pre-issuance guard left in the approve path**; removing it means approval proceeds straight to `generateAndSaveCertificate` (see D-12) |
| `src/lib/pdf.ts:9,46,144` + its `.specialization` CSS rule | parameter, destructuring, rendered line |
| `src/lib/course-draft.ts:5,55,180,204,413,431` | draft zod field, both snapshot reads, the publication-error call, the normalize-on-save |
| `src/app/api/admin/courses/route.ts:12,14,20,73,99,148-149,163` | create-course schema field, select, response, publication guard |
| `src/app/api/admin/courses/[courseId]/route.ts:12,20,72-76,91` | update-course equivalents |
| `src/app/api/admin/courses/[courseId]/editor/route.ts:17` | select field |
| `src/app/(dashboard)/admin/courses/page.tsx:38,46,132,392-393` | new-course form field |
| `src/app/(dashboard)/admin/courses/[courseId]/edit/LegacyCourseEditorPage.tsx:17,210-211,1016-1021,1124` | form field, dirty-diff, the 100-char counter, and the publish-checkbox guard at `:1124` |
| `src/app/(dashboard)/admin/courses/components/CourseEditor.tsx:445-446` | form field |
| `prisma/seed.ts:301,435,524` | three seeded values |
| `docs/academy-certificate-template.md:19,30` | the `Course.certificateSlogan` node and its rule paragraph |
| `tests/course-certificate-slogan.test.ts` | **Delete** |
| `tests/certificate-pdf.test.ts:33` | drop the slogan input; assert the rendered HTML contains **no** `specialization` element |
| `tests/certificate-service.test.ts:54,65,77` | drop the three slogan fixtures and the "throws without slogan" case |
| `src/lib/__tests__/course-draft-publish.integration.test.ts:24,183-199` | drop the fixture field and **the "cannot publish without a slogan" case entirely** — that rule no longer exists |

**Already-issued certificates — OWNER-CONFIRMED: do not regenerate.** Historical PDFs keep
their printed specialization line. Consequence for `scripts/regenerate-certificates.{ts,mjs}`:

| | |
| --- | --- |
| **Choice** | **Retire both scripts — delete them.** |
| **Rejected** | Keep them, minus the slogan read, as opt-in manual tooling. |
| **Rationale** | Their only purpose is re-rendering stored PDFs from current course data. With the owner's no-regeneration policy that purpose is now *forbidden by policy* for the historical population, and for any certificate issued after this change the script would be a no-op re-render of an identical document. What survives is a loaded gun: a script whose one remaining effect is silently rewriting a legal artifact, with the guard rail (`if (!certificateSlogan) skip` at `:39`/`:43`) removed. If a genuine one-off re-render is ever needed, `generateAndSaveCertificate` is one call away and the deletion is one `git revert` away. Both `.ts` and `.mjs` go; keeping one is keeping the hazard. |

**Reactivation question — the safe answer is NO, change nothing.** The original migration
`20260805120000_add_certificate_slogan:6-9` ran `UPDATE "Course" SET "isActive" = false WHERE
"certificateSlogan" IS NULL OR btrim(...) = ''`. Dropping the publication rule makes those
courses *eligible* to be active again, but eligibility is not intent:

- The `isActive = false` rows are indistinguishable from courses the owner deactivated for
  ordinary reasons — that column has no provenance, and the original migration recorded none.
  Any reactivation `UPDATE` would therefore also republish courses that were deliberately
  retired, silently exposing them for purchase.
- Publishing a course is a **commercial** act. A schema migration is the wrong place to make
  one, and it is not reversible by re-running anything.
- The safe, correct path costs the owner one click per course: they are visible in the admin
  course list, and with the guard gone the publish toggle now simply works.

**Design decision: the drop migration contains the `DROP COLUMN` and nothing else.** No
`UPDATE`. This is recorded as an explicit non-action so a later reader does not read the
omission as an oversight.

### D-14 — Grant notification: reuse `dispatchNotification`, email is queued **[NEW 2026-09-01]**

The repo already has exactly the right infrastructure and it must not be bypassed.
`dispatchNotification` (`src/server/services/notification-dispatcher.ts:318`) persists the
in-app `Notification` **immediately and synchronously** inside one `db.$transaction`, and in
the same transaction writes a `PENDING` `NotificationDelivery` row for the EMAIL channel, which
`src/server/jobs/notification-delivery.job.ts` drains. It never throws — it catches internally
and returns `{ ok: false, error: 'NOTIFICATION_DISPATCH_FAILED' }` (`:456-464`), documented in
its own comment as "notification infrastructure cannot roll back a business operation".

| | |
| --- | --- |
| **Choice** | Add one event key `academy.attempts.granted` to `notificationEventKeys` (`notification-dispatcher.ts:26-54`), add one `NotificationEventService.attemptsGranted({ userId, courseId, targetTitle, attemptsGranted, actionUrl })` method alongside the existing ones, and call it from all three grant service functions (`grantAssessmentRevalidation`, `grantFinalExamRevalidation`, `grantLessonTestRevalidation`) after the revalidation row is written. Channels `[IN_APP, EMAIL]` via the existing `accountChannels()` helper, `preferenceCategory: COURSE_UPDATES`, `priority: HIGH`, `dedupeKey: 'revalidation:{revalidationId}:granted'`, `actionUrl` pointing at the lesson/course learn route. |
| **Rejected** | (a) Call `sendNotificationEmail` from `src/lib/mail.ts` directly plus a bare `NotificationService.createNotification`. (b) Emit from the three route handlers instead of the services. (c) Reuse an existing key such as `academy.review.completed`. |
| **Rationale** | (a) is the parallel mechanism the spec forbids: it would bypass notification preferences, the dedupe key, the delivery ledger, and the retry job — a grant email would have no record and no retry, unlike every other email on the platform. (b) would need the same 20 lines in three route files and would leave the notification unsent for any future non-HTTP caller (a script, the cron). (c) makes the notification undedupable against a real review event and mislabels the row in the ledger and in the user's preference filtering. `HIGH` priority matches the appointment precedent for "something is now unblocked for you"; `COURSE_UPDATES` is the only sensible one of the three existing categories. |

**Blocking or fire-and-forget: neither, precisely.** In-app is **synchronous and blocking** —
the row exists before the grant service returns, so the student sees it on their next poll.
Email is **queued, not sent inline**: the request writes a durable `PENDING` delivery row and
the `notification-delivery` job sends it, so the admin never waits on SMTP and a transient mail
outage produces a retry rather than a lost notification. That queued row is what satisfies the
spec's "an email is sent" — the design commitment is durable enqueue plus job-driven delivery,
which is how every other email on this platform works.

**If notification fails, the grant stands.** `dispatchNotification` returns an error object
instead of throwing, so the `await` cannot unwind the caller. It is called **after** the
`revalidation.create`, and deliberately **not** inside a transaction with it: the cap increase
is the student-visible effect and it must survive a notification-infrastructure failure, which
is exactly the spec's "Notification failure does not roll back the grant" scenario. The grant
service ignores the return value; the dispatcher already logs the failure at `:457`. The route
still returns `201`. This mirrors the certificate path's `.catch(() => {})` posture (D-12) —
same reasoning, better infrastructure.

---

## 4. Data Model

```
                 Lesson ──1:N── LessonTest ──1:N── LessonTestSubmission ──1:N── LessonTestAnswer
                                     │                        │
                                     │ 1:N                    │ N:1
                                     ▼                        ▼
              ┌──────────────────────────────────┐          User
              │  LessonTestRevalidation  (NEW)   │           ▲  ▲
              │──────────────────────────────────│  userId   │  │ grantedById
              │  id              TEXT  PK  cuid  │───────────┘  │  (RESTRICT)
              │  lessonTestId    TEXT  FK CASCADE│──────────────┘
              │  userId          TEXT  FK CASCADE│
              │  grantedById     TEXT  FK RESTRICT
              │  attemptsGranted INTEGER NOT NULL│   no UNIQUE — grants accumulate
              │  reason          TEXT NULL       │
              │  createdAt       TIMESTAMP(3) now│
              │──────────────────────────────────│
              │  idx (lessonTestId, userId)      │  ← the aggregate's access path
              │  idx (grantedById)               │  ← FK index; PG does not auto-create
              └──────────────────────────────────┘

     Structural twins, unchanged:
       AssessmentRevalidation  (schema.prisma:1073)  → Assessment
       FinalExamRevalidation   (schema.prisma:1396)  → FinalExam
```

### Prisma model

```prisma
model LessonTestRevalidation {
  id              String   @id @default(cuid())
  lessonTestId    String
  userId          String
  grantedById     String
  attemptsGranted Int
  reason          String?
  createdAt       DateTime @default(now())

  lessonTest LessonTest @relation(fields: [lessonTestId], references: [id], onDelete: Cascade)
  student    User       @relation("LessonTestRevalidationStudent",   fields: [userId],      references: [id], onDelete: Cascade)
  grantedBy  User       @relation("LessonTestRevalidationGrantedBy", fields: [grantedById], references: [id])

  @@index([lessonTestId, userId])
  @@index([grantedById])
}
```

Two back-relation edits are required or `prisma validate` fails:
`LessonTest.revalidations LessonTestRevalidation[]` (near `schema.prisma:1266`), and on `User`
(alongside `:192-193`) `lessonTestRevalidations` / `lessonTestGrants`.

### Migration SQL approach

`npx prisma migrate dev --name lesson_test_revalidation`. Review the generated file; it must contain
**only** these statements and nothing else:

```sql
CREATE TABLE "LessonTestRevalidation" (
    "id" TEXT NOT NULL,
    "lessonTestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "attemptsGranted" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LessonTestRevalidation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LessonTestRevalidation_lessonTestId_userId_idx" ON "LessonTestRevalidation"("lessonTestId", "userId");
CREATE INDEX "LessonTestRevalidation_grantedById_idx" ON "LessonTestRevalidation"("grantedById");
ALTER TABLE "LessonTestRevalidation" ADD CONSTRAINT "LessonTestRevalidation_lessonTestId_fkey"
  FOREIGN KEY ("lessonTestId") REFERENCES "LessonTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonTestRevalidation" ADD CONSTRAINT "LessonTestRevalidation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonTestRevalidation" ADD CONSTRAINT "LessonTestRevalidation_grantedById_fkey"
  FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

This matches `prisma/migrations/20260807161313_lesson_progress_assessments/migration.sql:121-131,
176-179, 221-227` exactly in shape. **Additive-only, no backfill, no `ALTER`/`DROP` of an existing
object.** If `migrate dev` emits anything else, the working-tree schema has drifted and apply must
stop. Cascades: deleting a lesson test or a student removes their grants (grants are meaningless
without the target); `grantedById` is `RESTRICT` so an admin account cannot be deleted while it still
carries audit rows — identical to both existing tables.

**Rollback**: application revert alone is safe — the table becomes unused and `submitLessonTest`
returns to counting `maxAttempts` only, so granted students lose the extra attempts but no submission
or score is lost. Schema rollback is a **new forward migration** `DROP TABLE "LessonTestRevalidation"`,
never a hand-edit of the applied file, and after a backup: the rows are admin grant decisions that
cannot be reconstructed.

---

## 5. Interfaces

```ts
// src/server/services/course-attempts-service.ts
export type AttemptSystem = 'ASSESSMENT' | 'LESSON_TEST' | 'FINAL_EXAM'

export type BlockedAttemptRow = {
  system: AttemptSystem
  targetId: string                    // assessmentId | lessonTestId | finalExamId
  targetTitle: string
  scopeLabel: string                  // 'Curso' | 'Módulo: X' | 'Estilo: X' | 'Lección: X'
  student: { id: string; name: string | null; email: string | null }
  attemptsUsed: number
  attemptsAllowed: number             // maxAttempts + Σ attemptsGranted
  lastAttemptAt: Date | null
  lastStatus: string | null           // NOT_PASSED | PENDING_REVIEW | null
  grantEndpoint: string               // ready-to-POST path, chosen by `system`
}

// [AMENDED 2026-09-01] — D-02/D-02b: select one target, then list its blocked students.
export type AttemptTarget = {
  system: AttemptSystem
  targetId: string
  title: string
  scopeLabel: string                  // 'Curso' | 'Módulo: X' | 'Estilo: X' | 'Lección: X'
  baseMaxAttempts: number
}
export function listCourseAttemptTargets(courseId: string): Promise<AttemptTarget[]>
export function listBlockedStudentsForTarget(
  courseId: string,                   // authorization scope: target must belong to it
  system: AttemptSystem,
  targetId: string
): Promise<BlockedAttemptRow[]>
// REMOVED: listBlockedStudents(courseId) — superseded by the two above.

// src/server/services/academy-assessment-service.ts  (additions)
export function grantLessonTestRevalidation(
  grantedById: string, lessonId: string, testId: string,
  userId: string, attemptsGranted: number, reason?: string | null
): Promise<LessonTestRevalidation>   // throws AcademyAssessmentError('REVALIDATION_NOT_AVAILABLE', 409)

// src/server/services/course-progress-analytics-service.ts   [AMENDED 2026-09-01] — D-05/D-11
export type CourseProgressAnalytics = {
  enrolledStudents: number
  completedStudents: number
  completionRate: number                                   // 0-100, 0 when enrolled === 0
  modules: { moduleId: string; title: string; order: number; completedStudents: number }[]
  lessons: {
    lessonId: string; title: string; sequenceIndex: number
    moduleTitle: string | null                             // null = course-level lesson (D-11)
    reachedStudents: number; completedStudents: number
  }[]
  dropOff: {
    lessonId: string | null                                // null = the "no ha empezado" bucket
    label: string
    sequenceIndex: number | null
    students: number
  }[]
}
export function getCourseProgressAnalytics(courseId: string): Promise<CourseProgressAnalytics>

// src/server/services/marketing-analytics-service.ts — UNCHANGED. The `courseId` widening
// is CUT from this change (D-05). Do not touch this file.

// src/server/services/notification-dispatcher.ts   [NEW 2026-09-01] — D-14
// add "academy.attempts.granted" to notificationEventKeys

// src/server/services/notification-event-service.ts   [NEW 2026-09-01] — D-14
static attemptsGranted(input: {
  userId: string; courseId: string; revalidationId: string
  targetTitle: string; attemptsGranted: number; actionUrl: string
}): Promise<void>                    // never throws; dispatch failure is logged, not propagated

// src/app/components/useChatRoom.ts
export function useChatRoom(roomId: string | null): {
  messages: ChatMessage[]; text: string; setText: (v: string) => void
  pendingImage: File | null; pendingPreview: string | null
  selectImage: (e: React.ChangeEvent<HTMLInputElement>) => void
  removePending: () => void; appendMention: (u: ChatMessage['user']) => void
  send: (e: React.FormEvent) => Promise<void>
  sending: boolean; initialLoading: boolean; error: string | null
  messagesEndRef: React.RefObject<HTMLDivElement>
  fileInputRef: React.RefObject<HTMLInputElement>
}
export function useCourseChatRoom(courseId: string): { roomId: string | null; noAccess: boolean }
```

Error contract, unchanged from the existing convention: services throw
`AcademyAssessmentError(code, message, status)` / `LearningContentError(...)`; routes map them
centrally to `NextResponse.json({ success: false, error, code }, { status })`, with `z.ZodError` →
`400` and an unrecognised error → `console.error` + `500`. Never swallow: the new
`grantLessonTestRevalidation` propagates its typed error rather than returning `null`.

**Response envelope**: the new `/api/admin/courses/[courseId]/analytics` returns
`{ success, data }` to match its `/api/admin/courses/**` namespace and what `CourseAdminTabs` already
parses — **not** the `{ ok, data }` used by `/api/admin/analytics/*` (`analytics/utils.ts:31`). That
inconsistency is pre-existing; do not propagate it and do not "fix" it here.

---

## 6. Data Flow

### 6.1 Unified attempts listing and grant

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant Tab as CourseAdminTabs (Attempts)
    participant R1 as GET /api/admin/courses/[id]/attempts
    participant S as course-attempts-service
    participant DB as Postgres
    participant R2 as POST .../revalidations
    participant AS as academy-assessment-service

    Admin->>Tab: open "Intentos" tab
    Tab->>R1: GET .../attempts/targets
    R1->>R1: getAdminUser() — 403 if not ADMIN
    R1->>S: listCourseAttemptTargets(courseId)
    par 3 queries, titles + maxAttempts only, no attempt data
        S->>DB: assessment.findMany (course OR module OR style OR lesson)
        S->>DB: lessonTest.findMany via lesson.courseId
        S->>DB: finalExam.findUnique(courseId)
    end
    S-->>R1: AttemptTarget[]
    R1-->>Tab: { success: true, data }
    Tab-->>Admin: selector list; empty state "elegí un test" — NO combined list

    Admin->>Tab: select ONE test/exam
    Tab->>R1: GET .../attempts?system=&targetId=
    R1->>S: listBlockedStudentsForTarget(courseId, system, targetId)
    S->>DB: load target + assert it belongs to courseId  %% 404 otherwise
    S->>DB: attempt.groupBy(userId) _count + _max(submittedAt)
    S->>DB: passed-set findMany for this target
    S->>DB: revalidation.groupBy(userId) _sum(attemptsGranted)
    S->>DB: user.findMany({ id: { in: blockedUserIds } })
    S-->>R1: BlockedAttemptRow[]  (used >= allowed AND NOT passed)
    R1-->>Tab: { success: true, data }  %% 4 queries, one target — D-02

    Admin->>Tab: click "Habilitar 1 intento" on a row
    Tab->>R2: POST row.grantEndpoint { userId, attemptsGranted: 1, reason }
    R2->>R2: getAdminUser() + inline Zod parse
    R2->>AS: grantLessonTestRevalidation(...)
    AS->>DB: re-check used >= allowed AND NOT passed
    alt precondition fails
        AS-->>R2: AcademyAssessmentError REVALIDATION_NOT_AVAILABLE
        R2-->>Tab: 409 { success:false, error, code }
        Tab-->>Admin: sonner error toast, row unchanged
    else ok
        AS->>DB: INSERT LessonTestRevalidation (cap +1; D7 — no reset, no score discarded)
        AS->>DB: dispatchNotification academy.attempts.granted %% D-14: in-app row now,
        Note over AS,DB: EMAIL NotificationDelivery queued PENDING in the same tx.<br/>Returns { ok:false } instead of throwing — the grant stands either way.
        R2-->>Tab: 201 { success:true, data }
        Tab->>R1: refetch
        Tab-->>Admin: success toast, row disappears
    end
```

### 6.2 Final exam pass → certificate → email, including failure paths

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant R as POST .../final-exam/attempts/[id]/review
    participant AS as academy-assessment-service
    participant CS as certificate.service
    participant PDF as lib/pdf
    participant R2 as lib/storage (R2)
    participant DB as Postgres
    participant Mail as lib/mail

    Admin->>R: review attempt APPROVED
    R->>AS: reviewFinalExamAttempt(...)
    AS->>DB: load attempt
    alt status !== PENDING_REVIEW
        AS-->>R: 409 FINAL_EXAM_ATTEMPT_ALREADY_REVIEWED
    end
    Note over AS,DB: [AMENDED 2026-09-01] the certificateSlogan lookup and the<br/>409 COURSE_CERTIFICATE_SLOGAN_MISSING branch are DELETED here (D-13).<br/>Issuance proceeds directly.

    AS->>CS: generateAndSaveCertificate(userId, courseId)
    CS->>DB: findFirst certificate valid=true
    alt already exists (idempotent hit)
        CS-->>AS: existing certificate — no PDF, no email
    else none
        CS->>PDF: generateCertificatePdf
        CS->>R2: uploadFile
        Note over CS,DB: race closed by the WS-D08 partial unique index (owner-approved);<br/>P2002 is caught, re-read, and the winner returned
        CS->>DB: INSERT Certificate
        CS->>DB: INSERT UserActivity  .catch(() => {})
        CS->>DB: notifications (absorb their own failures)
        CS->>Mail: sendCertificateEmail  .catch(() => {})
        Note over Mail: mail failure NEVER rolls back a valid certificate
        CS-->>AS: new certificate
    end

    alt issuance threw (PDF/R2/DB)
        AS-->>R: 502 CERTIFICATE_ISSUE_FAILED — attempt stays PENDING_REVIEW, admin retries
    else
        AS->>DB: UPDATE attempt status=APPROVED, reviewedAt, reviewedById
        AS-->>R: 200
    end

    Note over Admin,DB: legacy path — POST /api/admin/certificates/[id]/approve<br/>calls the same generateAndSaveCertificate, then deletes the<br/>valid=false placeholder. Either order ⇒ exactly one valid Certificate.
```

---

## 7. File Changes

### Created

| File | Purpose |
| --- | --- |
| `prisma/migrations/<ts>_lesson_test_revalidation/migration.sql` | Additive table + 2 indexes + 3 FKs |
| `src/server/services/course-attempts-service.ts` | `listBlockedStudents` — the D-02 aggregation |
| `prisma/migrations/<ts>_certificate_valid_partial_unique/migration.sql` | **[AMENDED]** WS-D08 partial unique index, raw SQL |
| `prisma/migrations/<ts>_drop_certificate_slogan/migration.sql` | **[NEW]** destructive `DROP COLUMN`, D-13. `DROP COLUMN` and nothing else |
| `src/server/services/course-progress-analytics-service.ts` | **[AMENDED]** `getCourseProgressAnalytics` — D-05/D-11. Replaces the planned `course-learning-analytics-service.ts` |
| `src/app/api/admin/lessons/[lessonId]/tests/[testId]/revalidations/route.ts` | LessonTest grant; clones the final-exam route's shape |
| `src/app/api/admin/courses/[courseId]/attempts/route.ts` | **[AMENDED]** `GET ?system&targetId` — blocked students for ONE target |
| `src/app/api/admin/courses/[courseId]/attempts/targets/route.ts` | **[NEW]** `GET` — the D-02b selector list |
| `src/app/api/admin/courses/[courseId]/analytics/route.ts` | **[AMENDED]** `GET`, **no query params** — progress only |
| `src/app/api/student/my-courses/route.ts` | Sidebar course list, admin bypass (D-10) |
| `src/app/(dashboard)/admin/courses/components/CourseAttemptsPanel.tsx` | **[AMENDED]** target selector + empty state + scoped blocked list |
| `src/app/(dashboard)/admin/courses/components/CourseAnalyticsPanel.tsx` | **[AMENDED]** progress-only recharts; no date presets |
| `src/server/services/__tests__/course-progress-analytics-service.test.ts` | **[AMENDED]** D-05/D-11 unit (renamed) |
| `src/app/components/useChatRoom.ts` | `useChatRoom` + `useCourseChatRoom` (D-07) |
| `src/server/services/__tests__/academy-assessment-service.test.ts` | WS0 characterization |
| `src/server/services/__tests__/certificate-service.test.ts` | WS0 characterization |
| `src/server/services/__tests__/course-attempts-service.test.ts` | D-02/D-04 unit |
| `src/app/api/admin/courses/__tests__/course-attempts.integration.test.ts` | Aggregation + grant, real DB |
| `src/app/api/admin/certificates/__tests__/dual-issuance.integration.test.ts` | WS4, D-08 |

### Modified

| File | Change |
| --- | --- |
| `prisma/schema.prisma` | New model; `LessonTest.revalidations`; two `User` back-relations; **[AMENDED]** drop `Course.certificateSlogan:475` |
| `src/server/services/academy-assessment-service.ts` | `grantLessonTestRevalidation`; `getStudentLessonTests` and `submitLessonTest` count `maxAttempts + Σ grants`; **[AMENDED]** slogan guard `:696-700` deleted (D-13); `attemptsGranted` notification (D-14) |
| `src/server/services/learning-content-service.ts` | **[AMENDED]** slogan guard `:635-641` deleted (D-13); `attemptsGranted` notification on `grantAssessmentRevalidation` (D-14) |
| `src/server/services/certificate.service.ts` | **[AMENDED]** slogan select/guard/argument deleted (D-13); `P2002` catch-and-re-read for the WS-D08 index |
| `src/server/services/notification-dispatcher.ts` | **[NEW]** one event key `academy.attempts.granted` (D-14) |
| `src/server/services/notification-event-service.ts` | **[NEW]** `attemptsGranted()` (D-14) |
| `src/app/api/admin/certificates/[id]/approve/route.ts` | **[AMENDED]** slogan 409 `:50-63` deleted (D-13). Synchronous issuance at `:69` is already correct and stays (D-12) |
| `src/lib/pdf.ts` · `src/lib/course-draft.ts` · `src/app/api/admin/courses/**` · three admin course forms · `prisma/seed.ts` · `docs/academy-certificate-template.md` | **[NEW]** D-13 removal map — see the table in D-13 for exact lines |
| `src/app/(dashboard)/admin/courses/[courseId]/edit/CourseAdminTabs.tsx` | New `intentos` tab; `analiticas` renders the panel and drops the `/admin/analytics` anchor (`:83-88`); `<ChatWidget defaultOpen />` |
| `src/app/(marketing)/learn/[courseId]/page.tsx` | `<ChatWidget courseId defaultOpen />` at `:115` |
| `src/app/components/ChatWidget.tsx` | Consume the hooks; add `defaultOpen?: boolean` (default `false`) |
| `src/app/components/ChatPanel.tsx` | Consume `useChatRoom`; keep its own layout and scroll anchoring |
| `src/app/(dashboard)/components/Sidebar.tsx` | `CourseChatNavItems` collapsed group for `STUDENT_NAV`/`STAFF_NAV` |
| `src/app/(dashboard)/components/mobile/MobileDrawer.tsx` | Render the same group so mobile keeps parity |
| `src/server/services/__tests__/learning-content-service.test.ts` | Extend with `grantAssessmentRevalidation` + cap formula |

### Deleted **[NEW 2026-09-01]**

| File | Why |
| --- | --- |
| `src/validators/course.schema.ts` | Every export exists only to serve the slogan (D-13) |
| `scripts/regenerate-certificates.ts` · `scripts/regenerate-certificates.mjs` | Retired — no-regeneration policy makes their purpose forbidden (D-13) |
| `tests/course-certificate-slogan.test.ts` | Tests a deleted validator |

### Explicitly left alone

`ModuleTest` / `CourseTest` / `CourseExam` models and their ~30 routes (**live**, §2)
· `api/modules/[moduleId]/progress/route.ts` · `src/server/jobs/issueCertificate.job.ts`
(**[AMENDED]** retained unchanged as the D-12 safety net) · `src/server/services/marketing-analytics-service.ts`
(**[AMENDED]** the `courseId` widening is CUT — do not touch)
· `LearningContentManager.tsx` / `FinalExamManager.tsx` per-panel grants
(must keep working) · `components/academy/LearningUnitPlayer.tsx` (D-07) · `/api/admin/analytics/courses`
· `LessonTestManager.tsx` — the Attempts tab supersedes a per-panel list; do not build both.

---

## 8. Testing Strategy

`strict_tdd: true`. `academy-assessment-service.ts` has **zero** coverage today, so WS0 lands first
and must pass against **unmodified** production code. Established conventions: `vi.mock('@/lib/db', ...)`
with hand-rolled model stubs (`achievement-service.test.ts:10-31`); integration tests create and
`finally`-delete their own fixtures against the real DB (`course-structure-integrity.integration.test.ts`).

| Layer | File | Proves |
| --- | --- | --- |
| Unit (WS0, first) | `academy-assessment-service.test.ts` | `submitLessonTest` throws `LESSON_TEST_ATTEMPTS_EXHAUSTED` at `used >= maxAttempts`; `LESSON_TEST_ALREADY_PASSED`; `grantFinalExamRevalidation` refuses unless exhausted **and** latest is `NOT_PASSED`; `reviewFinalExamAttempt` issues the certificate **before** the status update and leaves the attempt `PENDING_REVIEW` when issuance throws. **[AMENDED]** The `COURSE_CERTIFICATE_SLOGAN_MISSING` characterization case is DROPPED: WS0 must not pin behaviour that WS-D deletes in the same PR, or the suite is red by construction. |
| Unit (WS0, first) | `certificate-service.test.ts` | `generateAndSaveCertificate` returns the existing valid certificate without calling `generateCertificatePdf`; a rejected `sendCertificateEmail` still resolves and still returns the certificate (the `.catch(() => {})` guard) |
| Unit (WS0, extend) | `learning-content-service.test.ts` | `grantAssessmentRevalidation` rejects when `attempts.length < maxAttempts + Σ grants`, and when the latest attempt is not `NOT_PASSED`; `attemptsGranted < 1` rejected |
| Unit (WS1) **[AMENDED]** | `course-attempts-service.test.ts` | `listCourseAttemptTargets` returns all three systems in one ordered list with correct `scopeLabel`s and returns `[]` for a course with no tests; `listBlockedStudentsForTarget` applies the blocked predicate per system; the cap formula sums multiple grants; a passed student is never blocked at any attempt count; a target belonging to another course is **rejected**, not silently read; `grantEndpoint` matches `system` |
| Unit (WS1) | `academy-assessment-service.test.ts` (extend) | `grantLessonTestRevalidation` precondition; `getStudentLessonTests`/`submitLessonTest` admit an attempt after a grant, and D7 — the prior failed submission and score survive |
| Unit (WS2) **[AMENDED]** | `course-progress-analytics-service.test.ts` | D6 completion rate; `enrolled === 0` → `0`, not `NaN`/divide-by-zero; an empty course returns empty arrays rather than throwing; **D-11**: `sequenceIndex` follows `(Module.order, Lesson.order)` with module-less lessons appended last; a student's bucket is their MAX reached index, not their latest-touched row; a student with zero progress lands in the "no ha empezado" bucket; `reached` counts row presence while `completed` counts the flag |
| Unit (WS-E) **[NEW]** | `academy-assessment-service.test.ts` / `learning-content-service.test.ts` (extend) | Each of the three grant functions calls `dispatchNotification` once with `academy.attempts.granted`, `[IN_APP, EMAIL]`, and a `dedupeKey` derived from the revalidation id; **when the dispatcher returns `{ ok: false }` the grant still resolves and the revalidation row still exists**; the dispatcher is called AFTER the create, never inside its transaction |
| Unit (WS-D) **[NEW]** | `certificate-service.test.ts` · `certificate-pdf.test.ts` | `generateAndSaveCertificate` no longer reads `course.certificateSlogan` and no longer throws for a course without one; the rendered PDF HTML contains **no** `specialization` element |
| Integration (WS1) | `course-attempts.integration.test.ts` | End to end over a real DB: seed a blocked student in each of the three systems, `GET` returns all three rows, `POST` the LessonTest grant, re-`GET` shows the row gone and `attemptsAllowed` incremented; non-admin gets 403 |
| Integration (WS4) | `dual-issuance.integration.test.ts` | **Order A** automatic → manual, **Order B** manual → automatic, and the automatic path fired twice — each asserts `certificate.count({ userId, courseId }) === 1`, that the survivor is the `valid` one, and that no placeholder is orphaned. **[AMENDED]** the `it.todo` becomes a real test: concurrent issuance is rejected by the WS-D08 partial unique index and the `P2002` catch returns the winner. **D-12 coverage**: approval returns only after the certificate exists (assert it is queryable in the same response); a thrown `generateCertificatePdf` leaves the `valid:false` placeholder intact and returns `502`; a rejected `sendCertificateEmail` still returns `200` with a valid certificate; the cron then creates no second row |

Mock `@/lib/pdf`, `@/lib/storage`, and `@/lib/mail` in the certificate integration test — no R2 or SMTP
from a test run. UI panels are not unit-tested: there is no component-test infrastructure (no RTL, no
Playwright), and adding one is out of scope. `npm test` · `npm run test:db:setup && npm run test:integration`
· `npm run typecheck && npm run lint`.

---

## 9. Performance Notes

**Attempts aggregation — the N+1 trap and how it is avoided.** The naive shape is "for each student,
sum their grants for this assessment", which is `O(students × assessments)` queries. Instead the
service issues a **fixed ~13 queries regardless of student or attempt count**: per system, one target
lookup, one `groupBy(targetId, userId)` for `_count` and `_max(submittedAt)`, one passed-set
`findMany`, and one `revalidation.groupBy(targetId, userId) _sum(attemptsGranted)`; then a single
`user.findMany({ id: { in: blockedUserIds } })` shared across all three systems, issued last so it
only loads users that are actually blocked. Grouping and joining happen in memory over sets whose
size is bounded by attempt count, not by a query per row.

Every access path is already indexed: `AssessmentAttempt @@index([assessmentId, userId, status])`,
`AssessmentRevalidation @@index([assessmentId, userId])`, `LessonTestSubmission @@index([lessonTestId, userId])`,
`FinalExamAttempt @@index([finalExamId, userId, status])`, and the two new `LessonTestRevalidation`
indexes. The `IN` lists are bounded by per-course assessment/test counts (tens), not by users.

**Explicitly not reused**: `/api/admin/courses/[courseId]/students` (`students/route.ts:34-52`) runs
`getCourseLearningProgress` **per student** inside a `Promise.all` — roughly `4 × N` queries. It is an
existing hot spot; neither the Attempts tab nor the analytics panel may call it. Fixing it is out of
scope but worth a follow-up.

**[AMENDED 2026-09-01]** The paragraph above described the original whole-course aggregation.
It is superseded by D-02's cost table: the selector is 3 metadata-only queries and each
selected test is 4 scoped queries on single-`targetId` equality against existing composite
indexes. Net cost is lower than the old 13, and per-row work no longer scales with the number
of tests in the course.

**Progress analytics [AMENDED]**: 4 Prisma reads under one `Promise.all` (active access count,
valid-certificate distinct count, `moduleProgress.groupBy`, course structure) plus one
`lessonProgress.findMany` scoped by `lesson.courseId`, then the D-11 in-memory fold. The fold
is `O(students × lessons)` in memory on an admin-only page; the documented upgrade path if a
course outgrows it is the `DISTINCT ON` raw query rejected in D-11.
**Marketing [AMENDED]**: not touched at all. No new predicate, no new call. The
`split_part("path", '/', 3)` attribution coupling leaves this change's risk surface entirely.

**Chat**: `useChatRoom` keeps the existing 3s poll unchanged; two components now share one
implementation, so the interval count per mounted widget does not change. `defaultOpen` does start
polling on mount where it previously waited for a click — on exactly two pages, each with one widget.

---

## 10. Threat Matrix

**N/A** — this change introduces no routing (in the command/agent sense), shell command, subprocess,
version-control automation, PR automation, executable-file classification, or process-integration
boundary. It adds HTTP route handlers guarded by the existing `getAdminUser()` / session checks, a
Prisma table, and React components. Per the reference: *"If the change has no routing/shell/process
boundary, record the matrix as not applicable rather than expanding it."*

The genuine security surface is **auth-adjacent**, flagged by the proposal and reviewed as normal
application logic, not as a threat-matrix row:

| Surface | Requirement |
| --- | --- |
| `GET /api/admin/courses/[courseId]/attempts` · `analytics` · new grant route | `getAdminUser()` first; 403 before any DB read. Blocked-student rows expose student names and emails. |
| `GET /api/student/my-courses` | Returns only the caller's own active `CourseAccess`; admin bypass mirrors `chat/rooms/[courseId]:45-59` exactly. Never accepts a `userId` parameter. |
| Sidebar entries | Presence of an entry must never grant access — `/api/chat/rooms/[courseId]` remains the sole authority and re-checks on every open. |

---

## 11. Migration / Rollout

1. Merge behind the normal `feature/*` → `dev` → `staging` → `main` flow. No direct pushes; `AGENT.md`
   requires Plan Mode plus explicit human approval before production code changes.
2. **[AMENDED] Three migrations, applied in this order**: (a) `LessonTestRevalidation`
   `CREATE TABLE` — additive, empty, zero downtime; (b) the WS-D08 `CREATE UNIQUE INDEX ...
   WHERE "valid" = true` — **verify first** that no `(userId, courseId)` pair already has two
   `valid: true` certificates, or index creation fails on production data; (c) the
   `certificateSlogan` `DROP COLUMN`.
3. **[NEW] A full database backup is MANDATORY before (c).** It is the first irreversible
   statement this change ships: the column's values cannot be reconstructed from anything else,
   and issued PDFs are images of the text, not a queryable source. This step is not optional
   and not a formality.
4. **[NEW] Deploy order matters for (c).** Ship the application code that stops reading the
   column **before** running the drop, or in-flight requests hit "column does not exist". If
   the platform cannot guarantee that ordering, run (c) in a follow-up deploy on the same day.
5. Smoke on staging: open the Attempts tab, confirm the selector lists assessments, lesson
   tests, and the final exam and that **no student list renders before a selection**; select
   one test, grant once on a LessonTest, confirm the student can submit again and the prior
   score survived (D7), and confirm the student received both the in-app notification and a
   queued email delivery row (D-14).
6. **[AMENDED]** Verify the `analiticas` zero state on a course with no enrollments and no
   progress, and the drop-off distribution on a course where students stopped at different
   lessons. Confirm no date-range control is present.
7. **[NEW]** Publish a course that has no slogan and confirm the publication guard is gone.
   Confirm one previously-issued certificate PDF still renders its old specialization line
   (it is untouched storage — this is the no-regeneration policy working).
8. No feature flag. Every surface is admin-visible or additive-nav; there is nothing to
   dark-launch.
9. **Rollback**: revert the application commit. The `LessonTestRevalidation` table becomes
   unused; granted students lose the extra attempts but no submission or score is lost.
   `DROP INDEX` reverts WS-D08. **The slogan drop does NOT roll back**: re-adding the column
   restores the schema but not the data, so a revert of the application code past that point
   would put back readers of a now-empty column and re-deactivate courses on the next
   publication check. Treat (c) as a one-way door and decide before running it.

---

## 12. Resolved and Open Questions

### Resolved in this design

| Question | Resolution |
| --- | --- |
| Analytics date range | D-09 — 30-day default, 7/30/90 presets for marketing; learning metrics are lifetime and labelled so |
| Average score pooled or per system | D-06 — per system; the final exam has no score column, so pooling is a category error |
| Sidebar scale | D-10 — collapsed group, cap 8, "Ver todos", hidden when empty |
| Legacy `ModuleTest` / `CourseTest` | **NOT dead** (§2, verified). Untouched, and explicitly excluded from the Attempts tab and analytics with a visible UI note |
| One grant endpoint or three | D-03 — three; a polymorphic one would be a fourth surface, not a replacement |
| Aggregation shape | D-02 — one service, normalized union row; D-04 — one cap formula everywhere |
| Chat refactor vs. size budget | D-07 — extract the data hook; ~size-neutral and removes a live drift hazard |

### Resolved by owner (2026-09-01)

| Question | Resolution |
| --- | --- |
| D-08 concurrency | **Fix now.** Add the partial unique index (`WHERE "valid" = true`) as a second migration with raw SQL. The forward-only migration closes the real race — not just the sequential invariant — and its rollback is a plain `DROP INDEX`, recorded alongside the WS1 migration's rollback plan. Budget ~80 extra lines against the accepted `size:exception`. |
| Completion-rate proxy | **Accept the `0%` reading for courses with no final exam / no certificate flow**, surfaced with the existing UI label clarifying the metric is certificate-based. No second definition, no lessons-completed fallback. |
| `LessonTestManager` blocked list | **Unified Attempts tab only.** Do not add a per-panel blocked-students list to `LessonTestManager`. It stays the single source of truth for blocked students across all three systems (D4), avoiding a duplicated predicate. |

These three are now FIXED inputs for `sdd-tasks` and `sdd-apply`; do not reopen them.

### Resolved by this amendment (2026-09-01)

| Question | Resolution |
| --- | --- |
| Attempts view shape | **D-02/D-02b** — per-test selection, one flat selector spanning canonical and legacy systems, scoped query. Query cost goes **down** for the common case (7 vs 13). |
| Drop-off computation | **D-11** — in-memory sequence fold over `(Module.order, Lesson.order)`; `_max(lessonId)` is explicitly forbidden as it max-es a cuid |
| Analytics time semantics | **D-05** — everything is lifetime and unwindowed; the endpoint takes no `from`/`to`; D-09 presets withdrawn |
| Synchronous certificate issuance | **D-12** — already the current behaviour; failure table is now normative; the cron stays as a net |
| `scripts/regenerate-certificates.*` | **D-13** — retired and deleted, not kept as trimmed tooling |
| Reactivating slogan-deactivated courses | **D-13** — **NO.** The drop migration contains `DROP COLUMN` and nothing else; reactivation is a per-course owner decision through the admin UI |
| Grant notification mechanism | **D-14** — `dispatchNotification`; in-app synchronous, email durably queued; failure never rolls back the grant |

### Open questions **[NEW 2026-09-01]**

- [ ] **Not blocking design, blocking apply**: does a `valid: true` duplicate
      `(userId, courseId)` pair already exist in production? If yes, the WS-D08 index creation
      fails and a de-duplication step must precede it. Verify with a `GROUP BY ... HAVING
      count(*) > 1` before migration (b).
- [ ] Copy for the grant notification title/message is not specified here; `sdd-apply` should
      follow the Spanish register of the existing `notification-event-service.ts` entries.

---

## 13. Revised size forecast **[NEW 2026-09-01]**

Changed lines = `additions + deletions`, authored, tests included.

| Workstream | Prior | Revised | Δ | Why |
| --- | ---: | ---: | ---: | --- |
| WS0 characterization tests | 350 | **330** | −20 | Slogan characterization case dropped (WS-D deletes the behaviour) |
| WS1 attempts | 550 | **590** | +40 | Selector endpoint + service fn + panel selection state (+80); scoped query is simpler than the 3-system merge (−40) |
| WS2 analytics | 400 | **430** | +30 | Marketing half and presets cut (−120); D-11 fold, per-module/per-lesson rows, drop-off chart, and its unit cases (+150) |
| WS3 chat + sidebar | 350 | **350** | 0 | Untouched by this amendment |
| WS4 certificate | 150 | **230** | +80 | WS-D08 partial index migration + `P2002` handling + D-12 failure-path integration cases |
| **WS-D slogan removal** | — | **340** | +340 | ~20 files; net-negative in the codebase but a large reviewed diff. Includes 2 script deletions (~120) and 4 test files touched (~70) |
| **WS-E grant notification** | — | **150** | +150 | 1 event key, 1 service method (~35), 3 call sites (~30), unit coverage (~80) |
| **Total** | **1800** | **~2420** | **+620** | |

**Decision needed before apply: No** — `size:exception` is already accepted (D5) and the
strategy is `exception-ok`.
**Chained PRs recommended: Yes** — the forecast grew 34% and now carries an irreversible
migration.
**400-line budget risk: High** (~6× the 400-line default; ~3× the 800-line budget recorded for
this change).

**Guard note for `sdd-tasks`**: the owner accepted a single PR at ~1800 lines, not at ~2420
with a destructive `DROP COLUMN` in it. The design does **not** override D5, but WS-D is the
natural split candidate if the owner revisits: it is self-contained, touches no other
workstream's files except the two slogan guards, and is the only slice with a one-way-door
migration. Surface the revised number to the owner before apply; do not split unilaterally.

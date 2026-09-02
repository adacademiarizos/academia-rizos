# Tasks: Complete the Course Module

**Delivery**: `exception-ok` — single PR, ~2420 est. lines, `size:exception` accepted by the
owner on 2026-09-01, INCLUDING the irreversible `DROP COLUMN` in WS-D. The size and the
irreversible migration were explicitly re-confirmed by the owner after the design amendment
that raised the estimate from ~1880 to ~2420 lines; do not re-litigate the size and do not
propose chaining. See forecast at end.

### Suggested Work Units (commits within the single accepted PR)

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|
| 0 | WS0 characterization tests, zero prod change | `npm test -- academy-assessment-service certificate-service learning-content-service` | N/A — pure test addition, no runtime scenario | Revert commit; no prod code touched |
| 1 | WS1 `LessonTestRevalidation` + Attempts tab (selector + scoped query) | `npm test -- course-attempts-service academy-assessment-service` then `npm run test:integration -- course-attempts` | Grant 1 attempt on a blocked LessonTest in staging; row disappears | `git revert`; table unused if migration stays, or forward `DROP TABLE` |
| 2 | WS-D08 partial unique index + concurrency fix | `npm run test:integration -- dual-issuance` | Fire two concurrent `approve` calls on staging for same user+course | Forward migration `DROP INDEX`; revert `P2002` catch commit |
| 3 | WS2 per-course progress analytics (D-11 drop-off) | `npm test -- course-progress-analytics-service` then `npm run typecheck` | Open `analiticas` tab on a zero-data course in staging | Revert route+panel commit; `analiticas` tab reverts to prior state |
| 4 | WS3 chat hook extraction + default-open + sidebar | `npm run typecheck && npm run lint` | Open admin chat tab and `/learn/{id}` in staging; confirm default-open | Revert commit; `ChatWidget` returns to `useState(false)`, sidebar loses group |
| 5 | WS4 dual-issuance hardening tests | `npm run test:integration -- dual-issuance` | Approve legacy path after automatic issuance in staging | Revert test commit; no prod behavior change beyond Unit 2 |
| 6 | WS-D `Course.certificateSlogan` removal (destructive) | `npm test && npm run typecheck` | Publish a slogan-less course on staging; confirm no 409 | Application revert is safe; the `DROP COLUMN` itself is a one-way door — see Phase WS-D pre-tasks |
| 7 | WS-E grant notification (`academy.attempts.granted`) | `npm test -- academy-assessment-service learning-content-service` | Grant an attempt on staging; confirm in-app row + queued `NotificationDelivery` | Revert commit; grant functions stop calling `dispatchNotification` |

## Phase 0 — WS0: Characterization Tests (blocks all; strict TDD)

- [x] 0.1 `src/server/services/__tests__/academy-assessment-service.test.ts`: `submitLessonTest` throws `LESSON_TEST_ATTEMPTS_EXHAUSTED` at `used>=maxAttempts`, and `LESSON_TEST_ALREADY_PASSED`.
- [x] 0.2 Same file: `grantFinalExamRevalidation` precondition (exhausted + latest `NOT_PASSED`); `reviewFinalExamAttempt` issues certificate before status update and keeps attempt `PENDING_REVIEW` when issuance throws. **Do NOT pin `COURSE_CERTIFICATE_SLOGAN_MISSING` → 409** — WS-D deletes that behaviour in this same PR, so characterizing it here would make the suite red by construction.
- [x] 0.3 `src/server/services/__tests__/certificate-service.test.ts`: `generateAndSaveCertificate` short-circuits on existing valid certificate (no PDF regen); rejected `sendCertificateEmail` still resolves with the certificate (`.catch(() => {})` guard).
- [x] 0.4 Extend `src/server/services/__tests__/learning-content-service.test.ts`: `grantAssessmentRevalidation` rejects when `attempts.length < maxAttempts + Σgrants`, rejects when latest attempt is not `NOT_PASSED`, rejects `attemptsGranted < 1`.
- [x] 0.5 Run `npm test` — 0.1–0.4 pass against **unmodified** production code. Gate: do not start Phase 1 until green. (New tests: 15/15 pass — 6 in academy-assessment-service.test.ts, 2 in certificate-service.test.ts, 3 new in learning-content-service.test.ts + 4 pre-existing. Full-suite `npm test` has 18 pre-existing failing files unrelated to WS0, present before this batch — see apply-progress notes.)

## Phase 1 — WS1: Unified Attempts Tab

- [x] 1.1 Add `LessonTestRevalidation` model to `prisma/schema.prisma` (design §4); add `LessonTest.revalidations` and the two `User` back-relations (`lessonTestRevalidations`, `lessonTestGrants`).
- [x] 1.2 `npx prisma migrate dev --name lesson_test_revalidation`; diff generated SQL against design §4 (1 table, 2 indexes, 3 FKs, additive only) before committing. (Applied via hand-written migration `20260901000000_lesson_test_revalidation` + `prisma db execute` + `prisma migrate resolve --applied`, since `migrate dev` refused due to pre-existing checksum drift on unrelated older migrations; SQL matches design §4 exactly — 1 table, 2 indexes, 3 FKs, additive only. Also applied to `elizabeth_test` via `prisma migrate deploy`.)
- [x] 1.3 RED: `src/server/services/__tests__/course-attempts-service.test.ts` — **[AMENDED — D-02/D-02b]** `listCourseAttemptTargets(courseId)` returns all three systems (`Assessment`, `LessonTest`, `FinalExam`) in one ordered, flat list with correct `scopeLabel`s and `baseMaxAttempts`, final exam pinned last, `[]` for a course with no tests; `listBlockedStudentsForTarget(courseId, system, targetId)` applies the D-04 blocked predicate for the ONE selected target, sums multiple grants into the cap, never blocks a passed student, and **rejects** (does not silently read) a `targetId` that does not belong to `courseId` — `courseId` is an authorization argument, not a filter to trust blindly; `grantEndpoint` matches `system` for every row.
- [x] 1.4 GREEN: implement `src/server/services/course-attempts-service.ts` → `listCourseAttemptTargets(courseId)` (D-02b: 3 metadata-only queries — `assessment.findMany`, `lessonTest.findMany` via `lesson.courseId`, `finalExam.findUnique`) and `listBlockedStudentsForTarget(courseId, system, targetId)` (D-02: target-ownership check, then the 4 scoped queries — `attempt.groupBy(userId)` `_count`/`_max`, passed-set `findMany`, `revalidation.groupBy(userId) _sum`, `user.findMany` on the blocked id set). Do **not** implement a combined `listBlockedStudentsForCourse`/`listBlockedStudents(courseId)` — it is explicitly superseded and removed (design §5). (7/7 tests pass.)
- [x] 1.5 RED: extend `academy-assessment-service.test.ts` — `grantLessonTestRevalidation` precondition; post-grant `getStudentLessonTests`/`submitLessonTest` admit an attempt; D7 — prior failed submission/score survive.
- [x] 1.6 GREEN: implement `grantLessonTestRevalidation`; update `submitLessonTest`/`getStudentLessonTests` to count `maxAttempts + Σ attemptsGranted`. (12/12 tests pass in academy-assessment-service.test.ts.)
- [x] 1.7 Create `src/app/api/admin/lessons/[lessonId]/tests/[testId]/revalidations/route.ts` (mirrors the final-exam route shape) — `getAdminUser()`, inline Zod, `AcademyAssessmentError` mapping.
- [x] 1.8 **[AMENDED — D-02/D-02b]** Create two routes: `src/app/api/admin/courses/[courseId]/attempts/targets/route.ts` — `GET`, `getAdminUser()`, calls `listCourseAttemptTargets(courseId)`; and `src/app/api/admin/courses/[courseId]/attempts/route.ts` — `GET ?system=&targetId=`, `getAdminUser()`, inline Zod on the two query params, calls `listBlockedStudentsForTarget(courseId, system, targetId)`. Both keep `courseId` from the route param as the authorization scope, never from the query string.
- [x] 1.9 `src/app/api/admin/courses/__tests__/course-attempts.integration.test.ts`: seed one blocked student per system; `GET .../attempts/targets` returns all 3 targets; `GET .../attempts?system=&targetId=` for the LessonTest target returns that one blocked student; `POST` LessonTest grant; re-`GET` the same target shows the row gone, cap incremented; a `targetId` from a different course on this course's route → rejected (404/403, not silently scoped); non-admin → 403. (1/1 integration test passes against real Postgres.)
- [x] 1.10 **[AMENDED — D-02b]** Create `CourseAttemptsPanel.tsx`: fetches `listCourseAttemptTargets` on mount, renders a selector grouped by `scopeLabel` with no test pre-selected and an explicit "elegí un test" empty state — **MUST NOT** render any student list before a selection is made; on selection, fetches `listBlockedStudentsForTarget` and renders that target's rows only; wire the new `intentos` tab into `CourseAdminTabs.tsx`, dispatching grants via `row.grantEndpoint` and refetching the selected target's scoped list after a successful grant.
- [x] 1.11 Confirm `LearningContentManager.tsx` / `FinalExamManager.tsx` per-panel grant actions still work unchanged; confirm `LessonTestManager.tsx` gets **no** new blocked-list UI (owner decision, design §12). (Neither file touched by this phase — confirmed via `git status`.)
- [x] 1.12 Checkpoint: `npm test`, `npm run test:db:setup && npm run test:integration`, `npm run typecheck && npm run lint`. (`npm test`: 28/28 files, 168/168 tests pass. `npm run test:integration`: 6/8 files pass — the 2 failing files, `stripe/webhook` and `bookings/draft`, are pre-existing failures unrelated to WS1, present before this batch. `npm run typecheck`: clean. `npm run lint`: 15 pre-existing errors/108 warnings in files this phase never touched; zero issues in any Phase 1 file.)

## Phase 2 — WS-D08: Certificate Partial Unique Index (owner-approved 2026-09-01)

- [x] 2.1 RED: `src/app/api/admin/certificates/__tests__/dual-issuance.integration.test.ts` — new case: two concurrent `generateAndSaveCertificate` calls for the same `(userId, courseId)` resolve to exactly one `Certificate`; replace the prior `it.todo` with this real assertion.
- [x] 2.2 **[NEW — MANDATORY GATE]** Before creating the partial unique index, run against production data: `SELECT "userId", "courseId", count(*) FROM "Certificate" WHERE "valid" = true GROUP BY "userId", "courseId" HAVING count(*) > 1;`. This is a hard gate on migration 2.3 — `CREATE UNIQUE INDEX ... WHERE "valid" = true` fails outright if any duplicate `(userId, courseId, valid=true)` group exists. If the query returns any rows: STOP, do not run 2.3. For each duplicate group, keep the certificate that was actually delivered/most recently issued (cross-check `createdAt` and, if available, delivery/download evidence) and set `valid = false` on the other row(s) via a manual, reviewed one-off `UPDATE` outside this migration — never a blind "keep the newest" script without a human review, because it demotes what may be the certificate a student already downloaded. Record the outcome (0 duplicates found, or N duplicates resolved and how) in the PR description before proceeding to 2.3.
- [x] 2.3 `npx prisma migrate dev --create-only --name certificate_valid_unique_index`; hand-write `migration.sql` with only `CREATE UNIQUE INDEX "Certificate_userId_courseId_valid_key" ON "Certificate"("userId","courseId") WHERE "valid" = true;` (Prisma cannot express partial indexes in `schema.prisma` — no schema change here); apply with `npx prisma migrate dev`. Do not run this task until 2.2 confirms zero duplicates (or duplicates have been resolved).
- [x] 2.4 GREEN: in `certificate.service.ts`, wrap the `create` call in a `P2002` catch that re-reads and returns the existing valid certificate as the winner.
- [x] 2.5 Record rollback: forward migration `DROP INDEX "Certificate_userId_courseId_valid_key"`, never a hand-edit of the applied file; take a DB backup first (rows/index built on admin-issued certificates).
- [x] 2.6 Checkpoint: `npm run test:integration -- dual-issuance` — both firing orders (Order A, Order B) and the new concurrency case pass. Sequenced after Phase 1's migration.

## Phase 3 — WS2: Per-Course Progress Analytics **[AMENDED — D-05/D-11, progress-only]**

Marketing aggregation, the `MarketingAnalyticsService.getCourseAnalytics` `courseId` widening,
and the 7/30/90-day presets are **CUT** entirely (D-09 withdrawn). `MarketingAnalyticsService`
is not touched by this phase at all — no new parameter, no new call site. All metrics below are
lifetime and unwindowed; the endpoint takes no `from`/`to` query parameters.

- [x] 3.1 RED: `src/server/services/__tests__/course-progress-analytics-service.test.ts` (renamed from `course-learning-analytics-service.test.ts`) — D6 completion rate (`completedStudents/enrolledStudents`, `0` when enrolled is `0`, not `NaN`); an empty course (no lessons, no modules) returns empty `modules[]`/`lessons[]`/`dropOff[]` without throwing; per-module `completedStudents`.
- [x] 3.2 RED, same file, **D-11 last-lesson-reached**: `sequenceIndex` is derived by building the course sequence from `Module.order` (course-level `@@unique([courseId, order])`) then `Lesson.order` within each module, with module-less lessons (`Lesson.moduleId === null`) appended **last** — assert this explicitly against a fixture where `(Module.order, Lesson.order)` sequencing and lexicographic-cuid sequencing would produce **different, distinguishable** orderings, so the test fails if someone "simplifies" the fold back to `groupBy` with `_max: { lessonId }`. Explicitly assert that a plain `lessonProgress.groupBy({ by: ['userId'], _max: { lessonId } })` shape is NOT used to compute the bucket — `_max` on a `cuid` string returns the lexicographically largest id, which has no relationship to lesson order and would silently produce a wrong bucket; the correct value is `max(sequenceIndex)` per user computed from the in-memory fold over the built sequence. Also pin: a student with zero `LessonProgress` rows lands in the distinct "no ha empezado" bucket, not lesson index 0; `reachedStudents` counts row presence (`LessonProgress` existing) while `completedStudents` counts the `completed` flag — these must differ in the fixture.
- [x] 3.3 GREEN: implement `src/server/services/course-progress-analytics-service.ts` (design §5) → `getCourseProgressAnalytics(courseId)`: 4 Prisma reads under one `Promise.all` (active `CourseAccess` count via `buildActiveCourseAccessWhere()`, distinct valid-`Certificate` count, `moduleProgress.groupBy(moduleId)`, course structure — modules with lessons plus module-less lessons) plus one `lessonProgress.findMany` scoped by `lesson.courseId`, then the D-11 in-memory sequence fold (build `sequence`/`sequenceIndex` per §4 of design.md, bucket by each user's `max(sequenceIndex)`, restrict to users with active `CourseAccess`). Do **not** implement `averageScore`, `attempts`, `passRate`, or `blockedStudents` — all cut (D-05).
- [x] 3.4 Create `src/app/api/admin/courses/[courseId]/analytics/route.ts` — `GET`, **no query parameters** (no `from`/`to`), `getAdminUser()`, returns `{ success, data }` where `data` is `CourseProgressAnalytics` (namespace-consistent envelope matching `{ success, data }`, not the `{ ok, data }` shape used elsewhere — design §5). Do not widen or call `MarketingAnalyticsService` from this route.
- [x] 3.5 Create `CourseAnalyticsPanel.tsx` — recharts, progress-only: enrollment/completion summary, per-module completion bar, per-lesson reached-vs-completed, drop-off distribution chart including the "no ha empezado" bucket and the module-less-lessons group labelled distinctly; every metric labelled lifetime ("según certificados emitidos" on the completion caveat, design §5); explicit zero-state for a course with no enrollments (spec: Empty-State Handling scenarios). No date-range control of any kind.
- [x] 3.6 Wire the panel into `CourseAdminTabs.tsx` `analiticas` tab; remove the outbound `/admin/analytics` anchor.
- [x] 3.7 Checkpoint: `npm test`, `npm run typecheck && npm run lint`.

## Phase 4 — WS3: Course Chat Default-Open + Sidebar

- [x] 4.1 Extract `src/app/components/useChatRoom.ts` → `useChatRoom(roomId)` (messages, 3s poll, upload, send, mention, error/loading, design §5 interface); preserve `ChatPanel`'s `isAtBottomRef` scroll anchoring. (`isAtBottomRef`/`containerRef`/`scrollToBottom` kept in `ChatPanel.tsx`; hook exposes `messagesEndRef` only, per design §7 "keep its own layout and scroll anchoring".)
- [x] 4.2 Same file, `useCourseChatRoom(courseId)` — moves `ChatWidget`'s inline `roomId`-from-`courseId` resolution.
- [x] 4.3 Refactor `ChatWidget.tsx` to consume both hooks; add `defaultOpen?: boolean` (default `false`). Polling gated by passing `isOpen ? roomId : null` into `useChatRoom`, preserving the original open-only-poll behavior.
- [x] 4.4 Refactor `ChatPanel.tsx` to consume `useChatRoom`; layout/presentation unchanged. Manually diffed both components against pre-extraction behavior (no component-test infra exists, design §8) — JSX, classNames and Spanish copy unchanged; only state/handlers moved into the hook.
- [x] 4.5 Set `defaultOpen={true}` at `CourseAdminTabs.tsx` chat tab and `learn/[courseId]/page.tsx:115`; leave `LearningUnitPlayer.tsx:264` at `false` (D-07 table) — confirmed unchanged via `git status`/grep.
- [x] 4.6 Create `GET /api/student/my-courses` — caller's active `CourseAccess` courses; admin bypass mirrors `api/chat/rooms/[courseId]/route.ts:45-59`; never accepts a `userId` param (threat surface, design §10). (Uses `Course.isActive`, not `isPublished` — that field does not exist on `Course`.)
- [x] 4.7 Add `CourseChatNavItems` to `Sidebar.tsx` — collapsed "Chats de curso" group, cap 8 + "Ver todos", hidden when empty, `useEffect` fetch (`NotificationsNavItem` pattern, D-10); links to existing `/learn/{courseId}/chat`.
- [x] 4.8 Add the same group to `MobileDrawer.tsx` for mobile parity.
- [x] 4.9 Checkpoint: `npm test` — 29/29 files, 176/176 tests pass (no regression). `npm run typecheck` — clean. `npm run lint` — 15 pre-existing errors/108 pre-existing warnings unchanged; zero new errors in any file this phase touched (pre-existing `<img>` warnings in ChatWidget/ChatPanel already existed before extraction; the one pre-existing `Sidebar.tsx` error is at line 196, `setImgError` effect, untouched by this phase). Manually verified `/learn/{courseId}/chat` independently calls `GET /api/chat/rooms/[courseId]` itself on mount (`chat/page.tsx:22`) — the sidebar link never bypasses that auth check; the sidebar only supplies the link, not the room resolution.

## Phase 5 — WS4: Certificate Issuance Hardening (tests only)

- [x] 5.1 `dual-issuance.integration.test.ts` — Order A (automatic→manual) and Order B (manual→automatic): each asserts `certificate.count({ userId, courseId }) === 1`, survivor is `valid`, no orphaned placeholder. (Automatic path modeled by calling `generateAndSaveCertificate` directly, mirroring `reviewFinalExamAttempt`'s call; manual path modeled by the legacy placeholder-create → `generateAndSaveCertificate` → placeholder-delete sequence used by `approve/route.ts:69-70`.)
- [x] 5.2 Confirmed both issuance paths (`certificates/[id]/approve/route.ts`, `reviewFinalExamAttempt`) need no change beyond the Phase 2 `P2002` catch; no legacy surface removed (D2) — neither file touched in this phase, verified via `git status`.
- [x] 5.3 Checkpoint: `npm run test:db:setup && npm run test:integration -- dual-issuance` — 3/3 tests pass (concurrency case from Phase 2 + Order A + Order B). Full `npm run test:integration`: 7/9 files pass; the 2 failing files (`stripe/webhook`, `bookings/draft`) are the pre-existing, documented, unrelated failures — unchanged count from before this batch.

## Phase WS-D — `Course.certificateSlogan` Removal (destructive, ~20 files, one coherent commit) **[NEW]**

Design §D-13 / §11. This phase drops the column and removes every reader in one sweep. It MUST
land as one coherent commit/unit: landing it split leaves readers referencing a column that no
longer exists (or a schema field with no reader), and `npm run typecheck` fails mid-apply either
way. Sequenced after Phase 2 (WS-D08 index) per design §11's migration order (a) → (b) → (c).

**Mandatory pre-tasks (before the `DROP COLUMN` migration is written or applied):**

- [ ] D.1 **MANDATORY**: take a full database backup. This is the first irreversible statement
      in the whole change — `certificateSlogan` values cannot be reconstructed from anything
      else (issued PDFs are rendered images of the text, not a queryable source). Record the
      backup identifier/timestamp in the PR description. Do not proceed to D.10 (the drop
      migration) without this recorded.
- [ ] D.2 **MANDATORY, deploy-ordering**: confirm (or arrange) that the application code from
      this phase — which stops reading `certificateSlogan` everywhere — is deployed and live
      **before** the `DROP COLUMN` migration runs, so no in-flight request can hit "column
      `certificateSlogan` does not exist". If the deployment platform cannot guarantee that
      ordering atomically, run the drop migration (D.10) in a separate follow-up deploy on the
      same day, after confirming the code-only deploy is live everywhere.

**Removal — application code (land together, per design §D-13 table):**

- [x] D.3 Delete `src/validators/course.schema.ts` in full (`certificateSloganSchema`,
      `CERTIFICATE_SLOGAN_MAX_LENGTH`, `normalizeCertificateSlogan`, `getCoursePublicationError`
      — the file becomes exportless once the slogan is gone). Remove its four import sites.
- [x] D.4 `src/server/services/certificate.service.ts`: remove the slogan `select`, the guard,
      and the PDF call argument.
- [x] D.5 `src/server/services/academy-assessment-service.ts`: delete the whole
      `COURSE_CERTIFICATE_SLOGAN_MISSING` 409 block and its import.
- [x] D.6 `src/server/services/learning-content-service.ts`: delete the second
      `COURSE_CERTIFICATE_SLOGAN_MISSING` block and its import.
- [x] D.7 `src/app/api/admin/certificates/[id]/approve/route.ts`: delete the third slogan 409 —
      the only pre-issuance guard left in the approve path. After this, approval proceeds
      straight to `generateAndSaveCertificate` (D-12, already synchronous — no other change
      needed here).
- [x] D.8 `src/lib/pdf.ts`: remove the `certificateSlogan` parameter entirely (do not default it
      to `''`), the destructuring, and the rendered `.specialization` line; remove the matching
      CSS rule. Update `docs/academy-certificate-template.md` to drop the `Course.certificateSlogan`
      node and its rule paragraph.
- [x] D.9 `src/lib/course-draft.ts`: remove the draft zod field, both snapshot reads, the
      publication-error call, and the normalize-on-save.
- [x] D.10 Prisma: remove `certificateSlogan String?` from `prisma/schema.prisma`; write
      `prisma/migrations/<ts>_drop_certificate_slogan/migration.sql` containing **only**
      `ALTER TABLE "Course" DROP COLUMN "certificateSlogan";` — no `UPDATE`, no reactivation
      logic (owner-confirmed non-action: dropping the column does NOT reactivate any course;
      reactivation is a per-course owner decision through the existing admin UI toggle). Apply
      only after D.1 and D.2 are satisfied.
- [x] D.11 Admin routes: `src/app/api/admin/courses/route.ts` (create-course schema field,
      select, response, publication guard) and `src/app/api/admin/courses/[courseId]/route.ts`
      (update-course equivalents) and `src/app/api/admin/courses/[courseId]/editor/route.ts`
      (select field) — remove all slogan references.
- [x] D.12 Admin UI forms: `src/app/(dashboard)/admin/courses/page.tsx` (new-course form field),
      `src/app/(dashboard)/admin/courses/[courseId]/edit/LegacyCourseEditorPage.tsx` (form field,
      dirty-diff, the 100-char counter, and the publish-checkbox guard), and
      `src/app/(dashboard)/admin/courses/components/CourseEditor.tsx` (form field) — remove all
      three.
- [x] D.13 `prisma/seed.ts`: remove the three seeded `certificateSlogan` values.
- [x] D.14 Delete `tests/course-certificate-slogan.test.ts` in full (tests a deleted validator).
- [x] D.15 Update `tests/certificate-pdf.test.ts`: drop the slogan input; assert the rendered
      HTML contains **no** `specialization` element.
- [x] D.16 Update `tests/certificate-service.test.ts`: drop the three slogan fixtures and the
      "throws without slogan" case.
- [x] D.17 Update `src/lib/__tests__/course-draft-publish.integration.test.ts`: drop the fixture
      field and remove the "cannot publish without a slogan" case entirely — that rule no longer
      exists.
- [x] D.18 **Retire, do not trim**: delete `scripts/regenerate-certificates.ts` and
      `scripts/regenerate-certificates.mjs` in full. Owner-confirmed: already-issued certificates
      are NOT regenerated — historical PDFs keep their printed specialization line untouched. A
      script whose only remaining effect would be silently re-rendering a legal artifact, with
      its slogan guard rail removed, is a hazard to keep even as "opt-in manual tooling."
- [x] D.19 Checkpoint: `npm test`, `npm run typecheck && npm run lint`. Confirm no remaining
      reference to `certificateSlogan` anywhere in `src/`, `prisma/`, `scripts/`, `tests/`, or
      `docs/` (a repo-wide search must return zero hits outside this phase's own diff/history).
- [ ] D.20 Staging smoke (design §11 step 7): publish a course that has no slogan and confirm
      the publication guard is gone; confirm one previously-issued certificate PDF still renders
      its old specialization line (untouched storage — the no-regeneration policy working).

## Phase WS-E — Grant Notification (`academy.attempts.granted`) **[NEW — D-14]**

Reuses `dispatchNotification` (`src/server/services/notification-dispatcher.ts:318`) — no new
mechanism, no direct `sendNotificationEmail`/`createNotification` call, no per-route emission.

- [x] E.1 RED: extended `src/server/services/__tests__/academy-assessment-service.test.ts` and
      `src/server/services/__tests__/learning-content-service.test.ts` — each of the three grant
      functions (`grantAssessmentRevalidation`, `grantFinalExamRevalidation`,
      `grantLessonTestRevalidation`) calls `NotificationEventService.attemptsGranted` exactly
      once with `{ userId, courseId, revalidationId, attemptsGranted }`; when the mocked
      dispatcher call rejects/returns `{ ok: false, error: 'NOTIFICATION_DISPATCH_FAILED' }` the
      grant still resolves and the revalidation row still exists; asserted via
      `invocationCallOrder` that the notification call happens strictly after the
      `revalidation.create` call (confirmed 6 new RED tests failed against unmodified
      production code before implementation).
- [x] E.2 GREEN: added `academy.attempts.granted` to `notificationEventKeys` in
      `src/server/services/notification-dispatcher.ts`.
- [x] E.3 GREEN: added `NotificationEventService.attemptsGranted({ userId, courseId, revalidationId, targetTitle, attemptsGranted, actionUrl })` to `src/server/services/notification-event-service.ts` (design §5 signature) — `preferenceCategory: COURSE_UPDATES`, `priority: HIGH`, channels via the existing `accountChannels()` helper, `dedupeKey: 'revalidation:{revalidationId}:granted'`, `actionUrl` pointing at `/learn/{courseId}`. Wrapped in try/catch — never throws; dispatch failure is logged, not propagated. Spanish copy matches the register of existing entries (e.g. `coursePublished`, `achievementEarned`).
- [x] E.4 GREEN: called `NotificationEventService.attemptsGranted(...)` from all three grant
      functions (`grantAssessmentRevalidation` in `learning-content-service.ts`;
      `grantFinalExamRevalidation` and `grantLessonTestRevalidation` in
      `academy-assessment-service.ts`), after their respective `revalidation.create`, outside
      that create's transaction (none of the three functions use `$transaction` for the
      create itself). Call sites use `void` and ignore the return value. `courseId` resolution:
      `grantFinalExamRevalidation`/`grantAssessmentRevalidation` already have/derive `courseId`
      directly (assessment's own `courseId`, or its module/style/lesson relation, widened via an
      expanded `select`); `grantLessonTestRevalidation`'s `lessonTest.findFirst` query gained
      `include: { lesson: { select: { courseId: true } } }` to resolve it.
- [x] E.5 Checkpoint: `npm test -- academy-assessment-service learning-content-service certificate-service` — 3/3 files, 27/27 tests pass. `npm run typecheck` — clean. `npm run lint` — 123 problems (15 errors/108 warnings), unchanged from the pre-existing baseline, zero new issues. Full `npm run test`: 29/29 files, 182/182 tests (176 baseline + 6 new WS-E tests). No `academy-assessment-service` integration test file exists in this repo, so the staging smoke (in-app + queued `NotificationDelivery`) is deferred to actual staging deployment per the task's own wording ("Staging smoke") — not exercisable in this sandbox.

## Phase 6 — Final Verification

- [x] 6.1 `npm test` (full unit suite).
- [x] 6.2 `npm run test:db:setup && npm run test:integration` (full integration suite).
- [x] 6.3 `npm run typecheck && npm run lint`.
- [x] 6.4 Confirm every `proposal.md` Success Criterion is met and no Non-Goal (`LessonTest`/`Assessment` consolidation, `ModuleTest`/`CourseTest` removal, legacy certificate retirement) was touched.
- [ ] 6.5 Confirm the WS-D destructive migration ran only after D.1 (backup) and D.2 (deploy
      ordering) were satisfied, and that no course was reactivated as a side effect of the drop
      (owner-confirmed non-action).

## Review Workload Forecast **[AMENDED 2026-09-01]**

Changed lines by work stream (design §13):

| Workstream | Est. lines |
|---|---:|
| WS0 characterization tests | 330 |
| WS1 attempts (selector + scoped query) | 590 |
| WS2 progress analytics (D-11 drop-off) | 430 |
| WS3 chat + sidebar | 350 |
| WS4 certificate (WS-D08 index + D-12 tests) | 230 |
| WS-D slogan removal (destructive) | 340 |
| WS-E grant notification | 150 |
| **Total** | **~2420** |

| Field | Value |
|---|---|
| Estimated changed lines | ~2420 (revised from ~1880 after the 2026-09-01 design amendment) |
| 400-line budget risk | High (~6× the 400-line default) |
| 800-line budget risk | High (~3× the 800-line budget, exceeded by explicit owner exception) |
| Chained PRs recommended | No — owner explicitly re-accepted the single-PR delivery, including the irreversible `DROP COLUMN`, on 2026-09-01 after being shown the revised ~2420-line estimate. Do not re-litigate the size and do not propose chaining. |
| Suggested split | Single PR, 8 internal work units (see table above) |
| Delivery strategy | `exception-ok` |
| Chain strategy | `size-exception` |
| `size:exception` acceptance | Owner-accepted 2026-09-01 at ~2420 lines, including the irreversible `DROP COLUMN` in WS-D (design §D-13, §11) |

Decision needed before apply: No — `size:exception` already re-accepted by owner on 2026-09-01
at the revised ~2420-line estimate, including the irreversible migration.
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

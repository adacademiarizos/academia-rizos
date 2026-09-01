# Tasks: Complete the Course Module

**Delivery**: `exception-ok` — single PR, ~1880 est. lines, `size:exception` accepted 2026-09-01. See forecast at end.

### Suggested Work Units (commits within the single accepted PR)

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|
| 0 | WS0 characterization tests, zero prod change | `npm test -- academy-assessment-service certificate-service learning-content-service` | N/A — pure test addition, no runtime scenario | Revert commit; no prod code touched |
| 1 | WS1 `LessonTestRevalidation` + Attempts tab | `npm test -- course-attempts-service academy-assessment-service` then `npm run test:integration -- course-attempts` | Grant 1 attempt on a blocked LessonTest in staging; row disappears | `git revert`; table unused if migration stays, or forward `DROP TABLE` |
| 2 | WS-D08 partial unique index + concurrency fix | `npm run test:integration -- dual-issuance` | Fire two concurrent `approve` calls on staging for same user+course | Forward migration `DROP INDEX`; revert `P2002` catch commit |
| 3 | WS2 per-course analytics | `npm test -- course-learning-analytics-service` then `npm run typecheck` | Open `analiticas` tab on a zero-data course in staging | Revert route+panel commit; `analiticas` tab reverts to prior state |
| 4 | WS3 chat hook extraction + default-open + sidebar | `npm run typecheck && npm run lint` | Open admin chat tab and `/learn/{id}` in staging; confirm default-open | Revert commit; `ChatWidget` returns to `useState(false)`, sidebar loses group |
| 5 | WS4 dual-issuance hardening tests | `npm run test:integration -- dual-issuance` | Approve legacy path after automatic issuance in staging | Revert test commit; no prod behavior change beyond Unit 2 |

## Phase 0 — WS0: Characterization Tests (blocks all; strict TDD)

- [ ] 0.1 `src/server/services/__tests__/academy-assessment-service.test.ts`: `submitLessonTest` throws `LESSON_TEST_ATTEMPTS_EXHAUSTED` at `used>=maxAttempts`, and `LESSON_TEST_ALREADY_PASSED`.
- [ ] 0.2 Same file: `grantFinalExamRevalidation` precondition (exhausted + latest `NOT_PASSED`); `reviewFinalExamAttempt` issues certificate before status update and keeps attempt `PENDING_REVIEW` when issuance throws; `COURSE_CERTIFICATE_SLOGAN_MISSING` → 409.
- [ ] 0.3 `src/server/services/__tests__/certificate-service.test.ts`: `generateAndSaveCertificate` short-circuits on existing valid certificate (no PDF regen); rejected `sendCertificateEmail` still resolves with the certificate (`.catch(() => {})` guard).
- [ ] 0.4 Extend `src/server/services/__tests__/learning-content-service.test.ts`: `grantAssessmentRevalidation` rejects when `attempts.length < maxAttempts + Σgrants`, rejects when latest attempt is not `NOT_PASSED`, rejects `attemptsGranted < 1`.
- [ ] 0.5 Run `npm test` — 0.1–0.4 pass against **unmodified** production code. Gate: do not start Phase 1 until green.

## Phase 1 — WS1: Unified Attempts Tab

- [ ] 1.1 Add `LessonTestRevalidation` model to `prisma/schema.prisma` (design §4); add `LessonTest.revalidations` and the two `User` back-relations (`lessonTestRevalidations`, `lessonTestGrants`).
- [ ] 1.2 `npx prisma migrate dev --name lesson_test_revalidation`; diff generated SQL against design §4 (1 table, 2 indexes, 3 FKs, additive only) before committing.
- [ ] 1.3 RED: `src/server/services/__tests__/course-attempts-service.test.ts` — blocked predicate per system (D-04), cap sums multiple grants, passed student never blocked, empty course → `[]`, `grantEndpoint` matches `system`.
- [ ] 1.4 GREEN: implement `src/server/services/course-attempts-service.ts` → `listBlockedStudents(courseId)` (D-02 aggregation, fixed ~13 queries, design §9).
- [ ] 1.5 RED: extend `academy-assessment-service.test.ts` — `grantLessonTestRevalidation` precondition; post-grant `getStudentLessonTests`/`submitLessonTest` admit an attempt; D7 — prior failed submission/score survive.
- [ ] 1.6 GREEN: implement `grantLessonTestRevalidation`; update `submitLessonTest`/`getStudentLessonTests` to count `maxAttempts + Σ attemptsGranted`.
- [ ] 1.7 Create `src/app/api/admin/lessons/[lessonId]/tests/[testId]/revalidations/route.ts` (mirrors the final-exam route shape) — `getAdminUser()`, inline Zod, `AcademyAssessmentError` mapping.
- [ ] 1.8 Create `src/app/api/admin/courses/[courseId]/attempts/route.ts` — `GET`, `getAdminUser()`, calls `listBlockedStudents`.
- [ ] 1.9 `src/app/api/admin/courses/__tests__/course-attempts.integration.test.ts`: seed one blocked student per system; `GET` returns all 3; `POST` LessonTest grant; re-`GET` shows the row gone, cap incremented; non-admin → 403.
- [ ] 1.10 Create `CourseAttemptsPanel.tsx`; wire the new `intentos` tab into `CourseAdminTabs.tsx`, dispatching grants via `row.grantEndpoint`.
- [ ] 1.11 Confirm `LearningContentManager.tsx` / `FinalExamManager.tsx` per-panel grant actions still work unchanged; confirm `LessonTestManager.tsx` gets **no** new blocked-list UI (owner decision, design §12).
- [ ] 1.12 Checkpoint: `npm test`, `npm run test:db:setup && npm run test:integration`, `npm run typecheck && npm run lint`.

## Phase 2 — WS-D08: Certificate Partial Unique Index (owner-approved 2026-09-01)

- [ ] 2.1 RED: `src/app/api/admin/certificates/__tests__/dual-issuance.integration.test.ts` — new case: two concurrent `generateAndSaveCertificate` calls for the same `(userId, courseId)` resolve to exactly one `Certificate`; replace the prior `it.todo` with this real assertion.
- [ ] 2.2 `npx prisma migrate dev --create-only --name certificate_valid_unique_index`; hand-write `migration.sql` with only `CREATE UNIQUE INDEX "Certificate_userId_courseId_valid_key" ON "Certificate"("userId","courseId") WHERE "valid" = true;` (Prisma cannot express partial indexes in `schema.prisma` — no schema change here); apply with `npx prisma migrate dev`.
- [ ] 2.3 GREEN: in `certificate.service.ts`, wrap the `create` call in a `P2002` catch that re-reads and returns the existing valid certificate as the winner.
- [ ] 2.4 Record rollback: forward migration `DROP INDEX "Certificate_userId_courseId_valid_key"`, never a hand-edit of the applied file; take a DB backup first (rows/index built on admin-issued certificates).
- [ ] 2.5 Checkpoint: `npm run test:integration -- dual-issuance` — both firing orders (Order A, Order B) and the new concurrency case pass. Sequenced after Phase 1's migration.

## Phase 3 — WS2: Per-Course Analytics

- [ ] 3.1 RED: `src/server/services/__tests__/course-learning-analytics-service.test.ts` — D6 completion rate (`completedStudents/enrolledStudents`, `0` when enrolled is `0`); per-system average score with final exam absent (D-06); empty course → all zeroes.
- [ ] 3.2 GREEN: implement `src/server/services/course-learning-analytics-service.ts` → `getCourseLearningAnalytics(courseId)`, 8 Prisma aggregates under one `Promise.all` (design §5/§9).
- [ ] 3.3 Widen `MarketingAnalyticsService.getCourseAnalytics` to accept optional `courseId` (backward compatible); confirm existing all-courses callers unaffected.
- [ ] 3.4 Create `src/app/api/admin/courses/[courseId]/analytics/route.ts` — `GET ?from&to`, `getAdminUser()`, returns `{ success, data: { marketing, learning } }` (namespace-consistent envelope, design §5).
- [ ] 3.5 Create `CourseAnalyticsPanel.tsx` — recharts, 7/30/90-day presets for marketing (D-09), lifetime label on learning metrics, explicit zero-state (spec: Empty-State Handling scenarios).
- [ ] 3.6 Wire the panel into `CourseAdminTabs.tsx` `analiticas` tab; remove the outbound `/admin/analytics` anchor.
- [ ] 3.7 Checkpoint: `npm test`, `npm run typecheck && npm run lint`.

## Phase 4 — WS3: Course Chat Default-Open + Sidebar

- [ ] 4.1 Extract `src/app/components/useChatRoom.ts` → `useChatRoom(roomId)` (messages, 3s poll, upload, send, mention, error/loading, design §5 interface); preserve `ChatPanel`'s `isAtBottomRef` scroll anchoring.
- [ ] 4.2 Same file, `useCourseChatRoom(courseId)` — moves `ChatWidget`'s inline `roomId`-from-`courseId` resolution.
- [ ] 4.3 Refactor `ChatWidget.tsx` to consume both hooks; add `defaultOpen?: boolean` (default `false`).
- [ ] 4.4 Refactor `ChatPanel.tsx` to consume `useChatRoom`; layout/presentation unchanged. Manually diff both components against pre-extraction behavior (no component-test infra exists, design §8).
- [ ] 4.5 Set `defaultOpen={true}` at `CourseAdminTabs.tsx` chat tab and `learn/[courseId]/page.tsx:115`; leave `LearningUnitPlayer.tsx:264` at `false` (D-07 table).
- [ ] 4.6 Create `GET /api/student/my-courses` — caller's active `CourseAccess` courses; admin bypass mirrors `api/chat/rooms/[courseId]/route.ts:45-59`; never accepts a `userId` param (threat surface, design §10).
- [ ] 4.7 Add `CourseChatNavItems` to `Sidebar.tsx` — collapsed "Chats de curso" group, cap 8 + "Ver todos", hidden when empty, `useEffect` fetch (`NotificationsNavItem` pattern, D-10); links to existing `/learn/{courseId}/chat`.
- [ ] 4.8 Add the same group to `MobileDrawer.tsx` for mobile parity.
- [ ] 4.9 Checkpoint: `npm test`, `npm run typecheck && npm run lint`; manually verify a sidebar entry never bypasses `/api/chat/rooms/[courseId]` auth (spec: Course Chat Access Enforcement).

## Phase 5 — WS4: Certificate Issuance Hardening (tests only)

- [ ] 5.1 `dual-issuance.integration.test.ts` — Order A (automatic→manual) and Order B (manual→automatic): each asserts `certificate.count({ userId, courseId }) === 1`, survivor is `valid`, no orphaned placeholder.
- [ ] 5.2 Confirm both issuance paths (`certificates/[id]/approve/route.ts`, `reviewFinalExamAttempt`) need no change beyond the Phase 2 `P2002` catch; no legacy surface removed (D2).
- [ ] 5.3 Checkpoint: `npm run test:db:setup && npm run test:integration` — 5.1 and the Phase 2 concurrency case both green.

## Phase 6 — Final Verification

- [ ] 6.1 `npm test` (full unit suite).
- [ ] 6.2 `npm run test:db:setup && npm run test:integration` (full integration suite).
- [ ] 6.3 `npm run typecheck && npm run lint`.
- [ ] 6.4 Confirm every `proposal.md` Success Criterion is met and no Non-Goal (`LessonTest`/`Assessment` consolidation, `ModuleTest`/`CourseTest` removal, legacy certificate retirement) was touched.

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~1880 (1800 base forecast + ~80 for WS-D08) |
| 400-line budget risk | High |
| 800-line budget risk | High (exceeded by explicit owner exception) |
| Chained PRs recommended | No — owner rejected the 4-PR split |
| Suggested split | Single PR, 6 internal work units (see table above) |
| Delivery strategy | `exception-ok` |
| Chain strategy | `size-exception` |

Decision needed before apply: No — size:exception already accepted by owner on 2026-09-01.
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

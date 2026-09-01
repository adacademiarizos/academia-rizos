# Exploration — complete-course-module

**Phase**: sdd-explore
**Date**: 2026-08-31
**Artifact store**: openspec
**Baseline**: working tree on branch `dev` (many uncommitted modifications in admin/courses + learning content), NOT last commit.

> Persistence note: Engram MCP was unreachable this session (`uv_spawn`). This file is the
> persisted artifact for topic `sdd/complete-course-module/explore`.

## Headline finding

Three of the four reported gaps are **partially or fully implemented already** in the
working tree. The change is closer to "close one real hole + finish three partial ones +
add the missing test coverage" than to a four-feature greenfield build.

Orchestrator-verified facts (read directly from source, not taken on the sub-agent's word):

| Claim | Verified |
| --- | --- |
| No `LessonTestRevalidation` model exists (`prisma/schema.prisma`) | Confirmed — only `AssessmentRevalidation` (:1073) and `FinalExamRevalidation` (:1396) |
| `analiticas` tab renders an outbound link to `/admin/analytics` | Confirmed — `CourseAdminTabs.tsx`, anchor to `/admin/analytics` |
| `ChatWidget` starts closed | Confirmed — `ChatWidget.tsx:39` `useState(false)` |
| Sidebar has only one general "Comunidad" entry, no per-course chat | Confirmed — `Sidebar.tsx:43,50` |
| `ChatRoom` already models per-course rooms | Confirmed — `ChatRoomType` enum at `schema.prisma:774`, `type` default `COURSE` at :781 |

---

## Gap 1 — Test attempt (tries) management

Three parallel test/assessment systems coexist:

1. **`Assessment`** (scope `COURSE|MODULE|STYLE|LESSON`) + `AssessmentAttempt` + `AssessmentRevalidation`.
   Granting extra attempts is **implemented**: `grantAssessmentRevalidation`
   (`src/server/services/learning-content-service.ts:683`), API
   `POST /api/admin/assessments/[assessmentId]/revalidations`, and the admin panel
   `LearningContentManager.tsx` (~161-186) already lists students who ran out of attempts
   and calls that endpoint.
2. **`FinalExam` / `FinalExamAttempt` / `FinalExamRevalidation`** (per course).
   Implemented: `grantFinalExamRevalidation`
   (`src/server/services/academy-assessment-service.ts:717`), API
   `POST /api/admin/courses/[courseId]/final-exam/revalidations`, UI button
   "Habilitar 1 intento adicional" in `FinalExamManager.tsx:106-111`.
3. **`LessonTest` / `LessonTestQuestion` / `LessonTestSubmission` / `LessonTestAnswer`**
   (`schema.prisma:1252-1306`), managed by `LessonTestManager.tsx`, submitted through
   `submitLessonTest` (`academy-assessment-service.ts`), attempt cap enforced at ~:322
   (`submissions.length >= test.maxAttempts` -> `LESSON_TEST_ATTEMPTS_EXHAUSTED`).
   **No revalidation model, no grant service function, no API route, no admin UI.**
   This is the confirmed real hole for gap 1.

Legacy `ModuleTest` / `CourseTest` (+ `Question`, `ModuleSubmission`, `CourseTestSubmission`)
still exist with API routes, but their only admin UI consumer is
`LegacyCourseEditorPage.tsx`, which git status shows was renamed away from the routed
`page.tsx`. The live route now renders `CourseAdminTabs.tsx` -> `CourseEditor.tsx`.
They appear dead in the active admin flow — must be confirmed before touching.

**Enforcement pattern (consistent across the two working systems)**: compare
`attempts.length` against `maxAttempts` **plus** the sum of granted revalidations
(`_sum.attemptsGranted`). `LessonTest` lacks the grant-sum step because no grant model exists.

**Work required**: new `LessonTestRevalidation` model (mirror `FinalExamRevalidation`:
`lessonTestId`, `userId`, `grantedById`, `attemptsGranted`, `reason`, timestamps) +
**Prisma migration**; `grantLessonTestRevalidation` service fn; update
`getStudentLessonTests` / `submitLessonTest` attempt counting; new API route
`src/app/api/admin/lessons/[lessonId]/tests/[testId]/revalidations/route.ts`;
blocked-students list + grant action in `LessonTestManager.tsx`.

**Size**: Medium. **Migration**: Yes.

---

## Gap 2 — Per-course analytics

`CourseAdminTabs.tsx` `analiticas` tab currently renders only a link to `/admin/analytics`
— exactly the reported behaviour.

`MarketingAnalyticsService.getCourseAnalytics({ from, to })`
(`src/server/services/marketing-analytics-service.ts:360-431`) **already computes per-course**
page views, unique visitors, purchases, revenue by currency, and conversion rate for every
active course, returned as an array keyed by `courseId`. Exposed only via
`GET /api/admin/analytics/courses`, which returns *all* courses; there is no course-scoped
endpoint.

Page-view course attribution parses the URL path (`split_part("path", '/', 3)` over
`/courses/<id>`), so it depends on the marketing path shape `/courses/{courseId}` staying stable.

**Work required**: course-scoped endpoint (new
`src/app/api/admin/courses/[courseId]/analytics/route.ts` or a query param on the existing
route) + inline recharts UI replacing the outbound link.

Open question for design: the existing aggregation is **marketing** analytics (views,
purchases, revenue). The product owner may also expect **learning** analytics
(completion rate, average score, attempts, pass rate, blocked students). Those are not
computed anywhere today.

**Size**: Small if marketing-only; Medium if learning analytics are in scope. **Migration**: No.

---

## Gap 3 — Per-course chat + sidebar

Data model is already there: `ChatRoom` with `type: ChatRoomType { COMMUNITY, COURSE }` and
a unique `courseId` for COURSE rooms (`schema.prisma:774-788`).
`CommunityService.getOrCreateChatRoom(courseId)` / `getOrCreateCommunityRoom()` back
`GET /api/chat/rooms/[courseId]` and `/api/chat/rooms/community`, with access checks
(`isCourseAccessActive`, admin bypass).

Confirmed gaps:

- `ChatWidget.tsx:39` — `useState(false)`; the widget starts **closed**. The admin course
  `chat` tab even tells the user to open it with the floating button. The requirement is
  that the course chat be **open by default** in the course chat view.
- `Sidebar.tsx` — `STUDENT_NAV` (:50) and `STAFF_NAV` (:43) have a single "Comunidad" entry
  pointing at `/community` (general chat via `ChatPanel`). **No per-course chat entries.**
- No endpoint returns "my enrolled courses" for client-side nav. `CourseAccess` is queried
  server-side elsewhere; the closest student route is
  `/api/student/courses/[courseId]/learning-progress` (per course, not a listing).
  `Sidebar.tsx` is a client component with no such fetch today.
- `ChatWidget` was found wired into the **admin** `CourseAdminTabs`, but a grep found no
  `ChatWidget` in the student-facing `src/app/(marketing)/learn/[courseId]/page.tsx`.
  Needs product confirmation whether students have per-course chat at all today.

**Coupling hotspot**: `ChatWidget.tsx` (floating, per course) and `ChatPanel.tsx` (full
height, used by `/community`) duplicate roughly 80% of their logic — message list, image
upload, mention tokens. Changing default-open behaviour risks further drift unless the
shared logic is extracted into a hook.

**Size**: Medium. **Migration**: No.

---

## Gap 4 — Per-course final exam + automatic certificate email

**Largely already built.**

- `FinalExam` is per course (`courseId String @unique`, `schema.prisma:1323-1336`), managed by
  `FinalExamManager.tsx` inside the `material` tab of `CourseAdminTabs.tsx`.
- `reviewFinalExamAttempt` (`academy-assessment-service.ts:660-689`) issues the certificate
  **before** marking the attempt APPROVED, via `issueCertificateForReview` ->
  `generateAndSaveCertificate` (`src/server/services/certificate.service.ts:19-108`).
- `generateAndSaveCertificate` is idempotent (existing-valid-certificate check at :24-27),
  generates the PDF (`src/lib/pdf.ts`), uploads to storage (`src/lib/storage.ts`, R2),
  creates the `Certificate` row, fires `NotificationService.triggerOnCertificateIssued` /
  `triggerOnCourseCompletion`, and **sends the email** via `sendCertificateEmail`
  (`src/lib/mail.ts`) at :96-105, guarded with `.catch(() => {})` so a mail failure never
  rolls back a valid certificate.
- A missing `certificateSlogan` throws a clear `COURSE_CERTIFICATE_SLOGAN_MISSING`
  (`academy-assessment-service.ts:696-703`) rather than failing silently.

**Real remaining risk — dual certificate issuance paths:**

1. New automatic path: `FinalExamAttempt` APPROVED -> `generateAndSaveCertificate`.
2. Legacy manual path: `src/app/api/admin/certificates/[id]/approve/route.ts`, consumed by
   `ReviewActions.tsx`, tied to the old `Test` / `Submission` models
   (`schema.prisma:722-753`), where `Certificate.submissionId` links to a `Submission`.
   Reachable from `/admin/courses/review` (`CourseExamReviewView.tsx`).

Two admin surfaces can mint a `Certificate` for the same user+course. The idempotency check
should prevent duplicates, but this is untested.

Not verified in depth: `generateCertificatePdf` (`src/lib/pdf.ts`) and `sendCertificateEmail`
(`src/lib/mail.ts`) internals.

**Size**: Small (verification + tests + a scope decision). **Migration**: No.

---

## Tests

- `npm test` -> `vitest run`. Coverage (`npm run test:cov`) scoped to `src/lib/**` and
  `src/server/services/**`. Integration: `npm run test:integration` against a real Postgres
  test DB (`npm run test:db:setup`). Strict TDD is enabled in `openspec/config.yaml`.
- **`src/server/services/academy-assessment-service.ts` has NO test file.** The just-shipped
  `reviewFinalExamAttempt` auto-certificate logic and `grantFinalExamRevalidation` have
  zero unit coverage.
- `src/server/services/__tests__/learning-content-service.test.ts` exists but only covers
  `calculateMultipleChoiceScore` / `requiresManualReview` — not attempts, revalidation, or
  certificates.
- `src/server/services/__tests__/marketing-analytics-service.test.ts` exists;
  `getCourseAnalytics` coverage inside it was **not** verified.
- `src/app/api/admin/courses/__tests__/course-structure-integrity.integration.test.ts` is a
  good template for the new admin API integration tests.

## Conventions to follow

- Zod schemas inline in route handlers: `z.object({...}).parse(await request.json())`.
- Custom error classes (`LearningContentError`, `AcademyAssessmentError`) mapped centrally to
  `NextResponse.json({ success: false, error, code }, { status })`.
- Auth guards: `getAdminUser()` (`src/lib/admin-access.ts`) for admin-only routes;
  `requireAdminForScope(await getXScope(id))` for scope-aware learning-content routes.
- Service layer owns all Prisma access (`src/server/services/*.ts`); route handlers stay thin.
- Admin managers are client components using `fetch` + local state + `sonner` toasts,
  not server actions.
- `AGENT.md` mandates Plan Mode + explicit human approval before production code changes, and
  a `feature/*` -> `dev` -> `staging` -> `main` branching model with no direct pushes.

## Approaches considered

**A. Parity with the existing revalidation pattern (recommended).** Add
`LessonTestRevalidation` mirroring `FinalExamRevalidation`; treat gaps 2/3/4 as UI completion,
one new "my courses" endpoint, and test coverage.
*Pros*: one small additive model, reuses a pattern already proven twice in this codebase,
lowest risk. *Cons*: keeps three parallel attempt/revalidation implementations.

**B. Migrate `LessonTest` onto the canonical `Assessment` model (scope `LESSON`).**
*Pros*: removes duplication, one revalidation mechanism. *Cons*: needs a data migration for
existing `LessonTest*` rows, touches student test-taking routes/UI, far larger than the
reported gap; would blow the 800-line review budget. **Recommend deferring as a separate
consolidation change.**

**Recommendation**: Approach A, with Approach B recorded in the proposal's non-goals.

## Risks

- **Certificate dual-issuance path** — legacy `Submission`-based manual approve and new
  `FinalExamAttempt`-based automatic issue can both create a `Certificate` for the same
  user+course. Needs an explicit test and a product decision.
- **Zero coverage on `academy-assessment-service.ts`** — the exact file this change must
  modify, under strict TDD. Tests must come first.
- **`LessonTest` vs `Assessment(scope=LESSON)` duplication** — adding a third revalidation
  model treats the symptom, not the root duplication.
- **`ChatWidget` / `ChatPanel` duplication** — ~80% shared logic, high drift risk.
- **Uncommitted working-tree baseline** — the baseline this exploration read may shift before
  apply starts.
- **Dead legacy test models** (`ModuleTest`, `CourseTest`) — confirm nothing references them
  before assuming they are unreachable.

## Sizing

| Gap | Size | Migration |
| --- | --- | --- |
| 1. Attempt/tries management (`LessonTest` only) | Medium | Yes |
| 2. Per-course analytics | Small (marketing) / Medium (learning) | No |
| 3. Per-course chat + sidebar | Medium | No |
| 4. Final exam + auto certificate | Small (tests + scope decision) | No |

## Open questions for sdd-propose

1. Should the legacy manual certificate-approval flow
   (`api/admin/certificates/[id]/approve`, `Test`/`Submission`, `/admin/courses/review`) be
   retired in this change, or does it still serve courses predating `FinalExam`?
2. Per-course analytics: marketing metrics only (views, purchases, revenue, conversion), or
   also learning metrics (completion, average score, pass rate, blocked students)?
3. Do students already have per-course chat access on the learn page, or is per-course chat
   admin-only today?
4. Does granting extra attempts reset any progress, or only raise the cap?
5. Are the legacy `ModuleTest` / `CourseTest` models genuinely dead and safe to leave alone?

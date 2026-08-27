# QA Test Plan

Last updated: 2026-06-21

## Goal

Provide a reproducible QA matrix for the academy model change and the wider platform: courses, payments, certificates, evaluations, bookings, payment links, uploads, AI, permissions, and regressions.

Default tests use mocks for Stripe, Cloudflare R2, email, OpenAI, Prisma, and NextAuth. Real-provider smoke tests are optional and should only run with explicit test credentials.

## Environment Preparation

```bash
npm ci
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run lint
npx tsc --noEmit
npm run build
npm test
```

For CI or isolated local QA:

- Use a disposable database.
- Use Stripe test keys and a local webhook forwarder only for smoke tests.
- Keep R2/email/OpenAI mocked by default.
- Store screenshots and browser traces as build artifacts.

## Automated Test Layers

| Layer | Tool | Purpose |
| --- | --- | --- |
| Unit | Jest | Pure helpers, validators, payment math, access decisions |
| API route | Jest + mocks | Auth, permissions, payload validation, DB writes |
| Integration | Prisma test DB | Migration, seed, webhook idempotency, certificate state |
| Browser smoke | Puppeteer | Critical user/admin journeys |
| Manual exploratory | Checklist | Visual UX, edge cases, real-provider smoke |

## Academy Content Matrix

| Area | Cases | Expected Result |
| --- | --- | --- |
| Migration | Existing module with lessons | `General` style exists and all lessons get `styleId` |
| Migration | Module without lessons | Seed creates `General`; demo seed may create first fallback lesson |
| Ordering | Two styles in same module | Unique `moduleId + order`; UI shows ordered headings |
| Ordering | Two lessons in same style | Unique `styleId + order`; UI shows ordered lessons |
| Admin CRUD | Create/update/deactivate/delete style | Admin-only, validation errors are clear, only style cannot be deleted |
| Admin CRUD | Create/update/delete lesson by style | Lesson keeps `moduleId` legacy value and canonical `styleId` |
| Legacy alias | `GET /api/admin/modules/[moduleId]/lessons` | Flat lesson list includes `styleId` and `styleName` |
| Legacy alias | `POST /api/admin/modules/[moduleId]/lessons` | Creates inside `General` |
| Student API | Active styles only | Inactive styles are hidden |
| Student API | No course access | 403 |
| Student API | Expired rental | Lessons visible, video URLs null |
| Player UI | Style headings + nested lessons | Selecting a lesson updates the video without breaking resources/chat/likes |
| Progress | Complete module | Still writes `ModuleProgress(userId,moduleId)` |

## Payments Matrix

| Area | Cases | Expected Result |
| --- | --- | --- |
| Course checkout | Authenticated buyer | Stripe Checkout session created with correct amount/currency |
| Course checkout | Anonymous user | Redirect/auth error, no payment created |
| Course checkout | Already has access | Purchase blocked or converted to allowed existing-access state |
| Webhook | `checkout.session.completed` for course | Creates/updates `Payment`, grants `CourseAccess`, sends receipt/notification |
| Webhook | Duplicate event | Idempotent; no duplicate access/payment side effects |
| Webhook | Failed payment | Payment marked failed, no access |
| Booking payment | Full/deposit/authorization | Amounts match service billing rule |
| Payment links | Admin/staff creates link | Link has correct ownership, amount, expiration, and public pay page |
| Payment links | Paid link webhook | Marks link paid and sends notification |
| Stripe smoke | Test card 4242 | End-to-end checkout succeeds in test mode |

## Evaluations Matrix

| Area | Cases | Expected Result |
| --- | --- | --- |
| Module test | Available module access | Student can submit answers |
| Module test | Max attempts reached | Submission blocked |
| Module test | Auto-grade MC | Score and pass/fail are correct |
| Course tests | Non-final test | Saved independently from final exam |
| Final exam | Missing completed modules | Locked |
| Final exam | All modules complete | Available |
| Manual review | Pending submission | Admin can approve or request revision |
| Revision | Student resubmits | Status returns to pending and history remains inspectable |

## Certificates Matrix

| Area | Cases | Expected Result |
| --- | --- | --- |
| Eligibility | No final exam approval | Certificate absent/pending |
| Admin approval | Approved final exam | Certificate generated, PDF uploaded, email sent |
| PDF upload mock | R2 unavailable | Error is handled, no invalid certificate marked ready |
| Public verify | Valid code | Shows certificate details |
| Public verify | Revoked code | Shows revoked/invalid status |
| Public verify | Unknown code | 404 or not-found state |
| Download | Student owner | PDF link visible |
| Download | Different student | Forbidden |

## Bookings Matrix

| Area | Cases | Expected Result |
| --- | --- | --- |
| Availability | Business hours | Only open slots shown |
| Availability | Off day | No slots |
| Availability | Existing appointment | Conflicting slot hidden |
| Draft booking | Valid guest/customer | Creates pending appointment and payment |
| Stripe webhook | Paid deposit/full | Confirms appointment and records payment |
| Staff view | Assigned staff | Staff sees own appointment only |
| Admin view | Admin | Admin sees and edits all appointments |

## Uploads And AI Matrix

| Area | Cases | Expected Result |
| --- | --- | --- |
| Video upload | Valid file | R2 upload mock returns URL, lesson/module stores it |
| Video upload | Invalid type/size | Clear validation error |
| Resource upload | PDF/image | Stored with module/course association |
| Transcription | Mock OpenAI success | Transcript saved |
| Transcription | OpenAI failure | User sees retryable error, original upload remains |
| Synopsis | Mock OpenAI success | Lesson synopsis/summary saved |
| AI chat | Has course access | Answer uses course context |
| AI chat | No access | Forbidden |

## Permissions Matrix

| Role | Must Access | Must Be Blocked |
| --- | --- | --- |
| Anonymous | Marketing, public certificate verify | Course player, admin, staff, protected APIs |
| Student | Purchased course, own certificate, community | Admin/staff, unpurchased courses |
| Staff | Own appointments, own payment links, staff manual | Admin course editor, all users |
| Admin | All dashboards and APIs | None except invalid data |

## Browser Smoke Script

Minimum Puppeteer smoke:

1. Public catalog loads.
2. Course purchase CTA shows locked state for anonymous users.
3. Student login opens course dashboard.
4. Player renders style headings and nested lessons.
5. Admin login opens course editor.
6. Admin creates a style and lesson in that style.
7. Certificate review page loads pending submissions.
8. Payment links page creates a test link.
9. Booking wizard reaches Stripe test checkout.

## Exit Criteria

- Prisma validate/generate pass.
- Academy content Jest suite passes.
- New APIs have admin/student auth and validation coverage.
- Browser smoke passes on seeded data.
- Full lint/typecheck/build either pass or all unrelated pre-existing failures are documented with file/line examples.
- Payment/certificate/evaluation flows pass with mocks; optional Stripe smoke passes with test credentials.

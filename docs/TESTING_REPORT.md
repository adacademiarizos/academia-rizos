# Testing Report

Last updated: 2026-06-21

## Current Scope

This report covers the first implementation pass for `Curso -> Seccion/Modulo -> Estilo -> Leccion` plus baseline QA setup.

For the complete forward-looking matrix, see [`QA_TEST_PLAN.md`](QA_TEST_PLAN.md).
For the academy content model, see [`ACADEMY_CONTENT_MODEL.md`](ACADEMY_CONTENT_MODEL.md).

## Commands Executed

| Command | Result | Notes |
| --- | --- | --- |
| `npm ci` | Passed | Installed dependencies from lockfile. Reported npm audit vulnerabilities: 1 low, 29 moderate, 11 high, 2 critical after adding Jest dev deps. |
| `npx prisma validate --schema prisma/schema.prisma` | Passed | Schema with `ModuleStyle` is valid. |
| `npx prisma generate` | Passed | Prisma Client generated successfully. |
| `npm test -- --runTestsByPath tests/academy-content.test.ts` | Passed | 4 tests for academy content helpers. |
| `npm test` | Passed | 4 suites, 34 tests. Stabilized legacy analytics/achievement mocks. |
| Focused ESLint on new/touched academy files | Passed | Style routes, legacy lesson routes, helper, seed, and academy test are clean. |
| `npm run lint` | Failed | Full project has pre-existing unrelated lint debt. See below. |
| `npx tsc --noEmit` | Passed | Fixed the root `test-frontend.ts` global `test` collision by making the file a module. |
| `npm run build` | Passed | Applied local migration on `localhost/elizabeth`, confirmed no pending migrations on rerun, compiled 91 app routes/pages. |

## Automated Coverage

File: `tests/academy-content.test.ts`

Covered:

- `slugifyStyleName` normalizes style names.
- `ensureGeneralModuleStyle` returns an existing `General` style.
- `ensureGeneralModuleStyle` creates `General` at the next module style order.
- `getNextLessonOrder` increments within one style.

Existing service suites now run under Jest as well:

- `src/server/services/__tests__/analytics-service.test.ts`
- `src/server/services/__tests__/achievement-service.test.ts`
- `src/server/services/__tests__/notification-service.test.ts`

## Focused Academy Verification

These files passed focused ESLint:

- `prisma/seed.ts`
- `src/lib/academy-content.ts`
- `src/app/api/admin/courses/[courseId]/modules/route.ts`
- `src/app/api/admin/modules/[moduleId]/lessons/route.ts`
- `src/app/api/admin/modules/[moduleId]/styles/route.ts`
- `src/app/api/admin/modules/[moduleId]/styles/[styleId]/route.ts`
- `src/app/api/admin/styles/[styleId]/lessons/route.ts`
- `src/app/api/admin/styles/[styleId]/lessons/[lessonId]/route.ts`
- `src/app/api/student/modules/[moduleId]/styles/route.ts`
- `tests/academy-content.test.ts`

## Known Full-Project Failures

### ESLint

Full `npm run lint` currently reports 31 errors and 106 warnings across 90 files. The blocking errors are outside the new style APIs after focused cleanup.

Examples:

- `scripts/_tmp_delete_user.js`: forbidden `require()`.
- `src/app/(dashboard)/admin/analytics/**`: React purity errors from `Date.now()` during render.
- `src/app/(dashboard)/components/Sidebar.tsx`: synchronous `setState` in an effect.
- `src/app/(dashboard)/staff/appointments/page.tsx`: synchronous `setState` in an effect and unescaped quotes.
- Several existing admin module/resource routes use a local variable named `module`, which triggers `@next/next/no-assign-module-variable`.

Warnings include existing unused variables, missing hook dependencies, and `<img>` usage in multiple UI files.

### TypeScript And Build

Full `npx tsc --noEmit` passes.

Full `npm run build` passes. During the first build run, `prisma migrate deploy` applied `20260621160000_add_module_styles` to the local database configured in `.env` (`localhost/elizabeth`). A second build run reported no pending migrations and completed successfully.

## Next QA Pass

Recommended next pass:

1. Resolve full-project lint blockers or temporarily scope ESLint for CI while debt is triaged.
2. Add route-level Jest tests for admin style CRUD and student style access.
3. Add mocked Stripe webhook tests for course access/payment idempotency.
4. Add certificate approval + public verification tests.
5. Add Puppeteer smoke covering catalog, course purchase state, player with styles, admin editor, certificates, payment links, and booking checkout.

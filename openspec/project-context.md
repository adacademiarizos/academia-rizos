# Project Context — elizabeth-rizos-platform

<!-- Replaces the Engram topic `sdd-init/elizabeth-rizos-platform` because Engram MCP
     was not reachable in this session (uv_spawn failure). This file is the persisted
     project context artifact for the openspec persistence backend. -->

**Detected**: 2026-08-31
**Persistence backend**: openspec (file-based, `openspec/`)
**Artifact store mode**: `openspec`

## Stack

- **Framework**: Next.js 16.1.6, App Router, React 19.2.3, TypeScript (strict via `tsconfig.json`)
- **Database**: PostgreSQL via Prisma 6.19.2 (`prisma/schema.prisma`, migrations under `prisma/migrations/`)
- **Auth**: NextAuth 4.24, roles `ADMIN` / `STAFF` / `STUDENT`
- **Payments**: Stripe 20.3
- **Email**: Resend + nodemailer
- **AI**: OpenAI SDK 6.22
- **Styling**: Tailwind CSS 4 (`tailwindcss`, `@tailwindcss/postcss`)
- **Charts**: recharts
- **Forms**: react-hook-form + zod + @hookform/resolvers
- **Package manager**: npm (`package-lock.json` present)

## Architecture

- Next.js App Router with route groups: `src/app/(dashboard)`, `src/app/(marketing)`.
- API routes under `src/app/api/**` (admin, student, booking, payments, cron, etc.).
- Domain areas of note: courses/learning content, appointments/booking, billing, certificates, GDPR data retention, Stripe webhook lifecycle.
- Existing legacy SDD specs live in repo-root `specs/` (numbered `NN-*.md`), separate from the new `openspec/` scaffold — kept as historical reference, not migrated.
- Project-level skills index at `AGENT.md` (Spanish-language orchestrator instructions); domain skills in `/skills` (`frontend-rules.md`, `backend-rules.md`, `documentation-rules.md`) and `.agents/skills/stripe-best-practices/`.

## Testing Capabilities

**Strict TDD Mode**: enabled (test runner detected, no explicit override found)
**Detected**: 2026-08-31

### Test Runner

- Command: `npm test` → `vitest run`
- Framework: Vitest 4.1.8

### Test Layers

| Layer       | Available | Tool                                              |
| ----------- | --------- | -------------------------------------------------- |
| Unit        | ✅        | Vitest (`vitest.config.ts`, `src/**/*.{test,spec}.ts`) |
| Integration | ✅        | Vitest (`vitest.integration.config.ts`, `src/**/*.integration.test.ts`, real Postgres test DB via `npm run test:db:setup`) |
| E2E         | ⚠️ partial | `src/__tests__/etapa5-e2e.test.ts` smoke test against `localhost:3000` (excluded from default unit run); no Playwright/Cypress |

### Coverage

- Available: ✅
- Command: `npm run test:cov` → `vitest run --coverage` (provider v8, scoped to `src/lib/**`, `src/server/services/**`)

### Quality Tools

| Tool         | Available | Command              |
| ------------ | --------- | --------------------- |
| Linter       | ✅        | `npm run lint` → `eslint` (flat config, Next core-web-vitals + typescript) |
| Type checker | ✅        | `npm run typecheck` → `tsc --noEmit` |
| Formatter    | ❌        | — (no Prettier config detected) |

### Additional test-related scripts

- `npm run test:db:setup` → `tsx scripts/setup-test-db.mjs` (provisions `elizabeth_test` DB, required before integration tests)
- `npm run test:qa` → alias for `vitest run`

## Skill Registry

`.atl/skill-registry.md` was already present and current (last updated 2026-08-31, fingerprint recorded in `.atl/.skill-registry.cache.json`). No regeneration was needed this session; it indexes project skills (`stripe-best-practices`) and user-level skills (including `postgresql`, `vercel-react-best-practices`, `work-unit-commits`, `chained-pr`, `judgment-day`, etc.).

## Persistence Limitation (this session)

Engram MCP was unreachable (`uv_spawn` failure). All SDD context that would normally be saved to Engram topics (`sdd-init/{project}`, `sdd/{project}/testing-capabilities`, `skill-registry`) has instead been written as OpenSpec file artifacts:

- `openspec/config.yaml` — project config, strict TDD, phase rules
- `openspec/project-context.md` — this file (stack + testing capabilities)

If Engram becomes reachable in a future session, these should be mirrored into Engram topics per the `hybrid` convention, or left file-only if `openspec` remains the sole backend.

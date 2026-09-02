/**
 * Test environment defaults.
 *
 * `src/lib/env.ts` validates the environment at import time, so any test that
 * transitively reaches it (for example via `@/lib/mail`) fails to load when a
 * variable is missing. Locally that stays hidden because Prisma loads `.env`;
 * in CI there is no `.env`, so the module throws and the whole file fails to
 * collect.
 *
 * Filling only the gaps keeps this safe for the integration suite, which needs
 * the real DATABASE_URL, and removes the need for every test to remember to
 * mock `@/lib/mail`.
 */
const TEST_ENV_DEFAULTS: Record<string, string> = {
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  NEXTAUTH_SECRET: 'test-nextauth-secret',
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  STRIPE_SECRET_KEY: 'sk_test_000',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_000',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_000',
  EMAIL_FROM: 'test@example.com',
}

for (const [key, value] of Object.entries(TEST_ENV_DEFAULTS)) {
  if (!process.env[key]) process.env[key] = value
}

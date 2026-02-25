/**
 * Next.js instrumentation hook — runs once on server startup.
 *
 * Seeds admin users defined in the ADMIN_EMAILS environment variable.
 * ADMIN_EMAILS should be a comma-separated list of email addresses.
 *
 * Each email is upserted: created with role ADMIN if not present,
 * or promoted to ADMIN if the account already exists.
 *
 * This is idempotent — safe to run on every cold start.
 */
export async function register() {
  // Only run in the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Always include the platform owner account + any extras from env
  const DEFAULT_ADMINS = ['ad.academia.rizos@gmail.com']

  const fromEnv = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const emails = Array.from(new Set([...DEFAULT_ADMINS, ...fromEnv]))

  try {
    // Lazy-import to avoid Edge runtime issues
    const { db } = await import('@/lib/db')

    for (const email of emails) {
      const nameFallback = email.split('@')[0].replace(/[._-]+/g, ' ')

      await db.user.upsert({
        where: { email },
        create: {
          email,
          name: nameFallback,
          role: 'ADMIN',
        },
        update: {
          role: 'ADMIN',
        },
      })

      console.log(`[instrumentation] Admin user ensured: ${email}`)
    }
  } catch (err) {
    // Don't crash the server — just log the failure
    console.error('[instrumentation] Failed to seed admin users:', err)
  }
}

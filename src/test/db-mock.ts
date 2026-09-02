/**
 * Shared Prisma mock factory for unit tests.
 *
 * Services touch a growing number of Prisma models; hand-written mock objects
 * rot every time a service starts querying one more model. This factory returns
 * a Proxy that lazily creates a `vi.fn()` for any `db.<model>.<method>()` and any
 * top-level `db.$xxx()` client method, so a new model never breaks unrelated tests.
 *
 * Usage (the factory body runs hoisted, so import it dynamically):
 *
 *   vi.mock('@/lib/db', async () => {
 *     const { createDbMock } = await import('@/test/db-mock')
 *     return { db: createDbMock() }
 *   })
 */
import { vi, type Mock } from 'vitest'

/** Any Prisma delegate method, always a vitest mock. */
export type MockedModel = Record<string, Mock>

/** Structural stand-in for the mocked Prisma client. */
export type MockedDb = Record<string, MockedModel> & Record<`$${string}`, Mock>

function createModelMock(): MockedModel {
  const methods = new Map<string, Mock>()
  return new Proxy({} as MockedModel, {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined
      let fn = methods.get(prop)
      if (!fn) {
        fn = vi.fn()
        methods.set(prop, fn)
      }
      return fn
    },
    has: () => true,
    ownKeys: () => [...methods.keys()],
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  })
}

/**
 * Build a fully lazy Prisma client mock. Every accessed model returns a stable
 * delegate whose every accessed method is a stable `vi.fn()`, so
 * `vi.clearAllMocks()` and per-test `mockResolvedValue` work as usual.
 */
export function createDbMock(): MockedDb {
  const members = new Map<string, unknown>()
  return new Proxy({} as MockedDb, {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined
      // `await db` / structuredClone probes must not create a fake thenable.
      if (prop === 'then') return undefined
      let member = members.get(prop)
      if (!member) {
        member = prop.startsWith('$') ? vi.fn() : createModelMock()
        members.set(prop, member)
      }
      return member
    },
    has: () => true,
    ownKeys: () => [...members.keys()],
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  })
}

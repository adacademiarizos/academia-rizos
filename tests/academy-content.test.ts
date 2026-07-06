jest.mock('@/lib/db', () => ({
  db: {
    moduleStyle: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    lesson: {
      findFirst: jest.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import {
  ensureGeneralModuleStyle,
  getNextLessonOrder,
  slugifyStyleName,
} from '@/lib/academy-content'

const mockedDb = db as unknown as {
  moduleStyle: {
    findUnique: jest.Mock
    findFirst: jest.Mock
    create: jest.Mock
  }
  lesson: {
    findFirst: jest.Mock
  }
}

describe('academy content helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('normalizes style names into stable slugs', () => {
    expect(slugifyStyleName('Rizos 3A / 3B')).toBe('rizos-3a-3b')
    expect(slugifyStyleName('  Lacio & Ondulado  ')).toBe('lacio-ondulado')
    expect(slugifyStyleName('***')).toBe('estilo')
  })

  it('returns the existing General style when it already exists', async () => {
    const existing = { id: 'style-1', moduleId: 'module-1', slug: 'general' }
    mockedDb.moduleStyle.findUnique.mockResolvedValue(existing)

    await expect(ensureGeneralModuleStyle('module-1')).resolves.toBe(existing)
    expect(mockedDb.moduleStyle.create).not.toHaveBeenCalled()
  })

  it('creates General after the last style order when missing', async () => {
    const created = { id: 'style-created', moduleId: 'module-1', order: 3 }
    mockedDb.moduleStyle.findUnique.mockResolvedValue(null)
    mockedDb.moduleStyle.findFirst.mockResolvedValue({ order: 2 })
    mockedDb.moduleStyle.create.mockResolvedValue(created)

    await expect(ensureGeneralModuleStyle('module-1')).resolves.toBe(created)
    expect(mockedDb.moduleStyle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        moduleId: 'module-1',
        order: 3,
        name: 'General',
        slug: 'general',
      }),
    })
  })

  it('calculates the next lesson order for a style', async () => {
    mockedDb.lesson.findFirst.mockResolvedValue({ order: 4 })

    await expect(getNextLessonOrder('style-1')).resolves.toBe(5)
  })
})

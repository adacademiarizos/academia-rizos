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
  getNextLessonOrder,
  getNextStyleLessonOrder,
  slugifyStyleName,
} from '@/lib/academy-content'

const mockedDb = db as unknown as {
  moduleStyle: {
    findFirst: jest.Mock
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

  it('calculates the next lesson order for a module', async () => {
    mockedDb.lesson.findFirst.mockResolvedValue({ order: 4 })

    await expect(getNextLessonOrder('module-1')).resolves.toBe(5)
    expect(mockedDb.lesson.findFirst).toHaveBeenCalledWith({
      where: { moduleId: 'module-1', styleId: null },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
  })

  it('calculates the next lesson order for a style', async () => {
    mockedDb.lesson.findFirst.mockResolvedValue({ order: 2 })

    await expect(getNextStyleLessonOrder('style-1')).resolves.toBe(3)
    expect(mockedDb.lesson.findFirst).toHaveBeenCalledWith({
      where: { styleId: 'style-1', moduleId: null },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
  })
})

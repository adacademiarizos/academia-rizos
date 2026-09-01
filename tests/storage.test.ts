import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StorageConfigurationError, uploadFile } from '@/lib/storage'

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  LOCAL_UPLOADS_DIR: process.env.LOCAL_UPLOADS_DIR,
  R2_ENDPOINT: process.env.R2_ENDPOINT,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
}

let uploadDir = ''

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

beforeEach(async () => {
  uploadDir = await mkdtemp(join(tmpdir(), 'elizabeth-rizos-uploads-'))
  process.env.NODE_ENV = 'test'
  process.env.LOCAL_UPLOADS_DIR = uploadDir
  delete process.env.R2_ENDPOINT
  delete process.env.R2_ACCESS_KEY_ID
  delete process.env.R2_SECRET_ACCESS_KEY
  delete process.env.R2_BUCKET_NAME
})

afterEach(async () => {
  await rm(uploadDir, { recursive: true, force: true })
  restoreEnv()
})

describe('local storage fallback', () => {
  it('stores a thumbnail locally when R2 is absent in development', async () => {
    const url = await uploadFile('images/course-thumbnail.png', Buffer.from('thumbnail'), 'image/png')

    await expect(readFile(join(uploadDir, 'images', 'course-thumbnail.png'), 'utf8')).resolves.toBe('thumbnail')
    expect(url).toBe('/uploads/images/course-thumbnail.png')
  })

  it('requires R2 in production', async () => {
    process.env.NODE_ENV = 'production'

    await expect(uploadFile('images/course-thumbnail.png', Buffer.from('thumbnail'), 'image/png'))
      .rejects.toBeInstanceOf(StorageConfigurationError)
  })
})

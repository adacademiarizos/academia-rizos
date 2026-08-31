/**
 * Storage/File Upload Helper
 * Supports Cloudflare R2, AWS S3, and local testing
 *
 * Environment variables required:
 * - R2_ENDPOINT: https://your-account.r2.cloudflarestorage.com
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 * - R2_BUCKET_NAME
 */

import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client, UploadPartCommand, type CompletedPart } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { mkdir, unlink, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"

interface StorageConfig {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  accountId?: string
}

let s3Client: S3Client | null = null

export class StorageConfigurationError extends Error {
  constructor(message = 'Cloudflare R2 is not configured') {
    super(message)
    this.name = 'StorageConfigurationError'
  }
}

export function isR2Configured() {
  return Boolean(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  )
}

function useLocalStorage() {
  return process.env.NODE_ENV !== 'production' && !isR2Configured()
}

function getLocalUploadPath(key: string) {
  const normalizedKey = key.replaceAll('\\', '/').replace(/^\/+/, '')
  if (!normalizedKey || normalizedKey.split('/').includes('..')) {
    throw new Error('Invalid upload key')
  }

  const uploadsDir = resolve(process.env.LOCAL_UPLOADS_DIR ?? 'public/uploads')
  const targetPath = resolve(uploadsDir, normalizedKey)
  const relativePath = relative(uploadsDir, targetPath)
  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error('Invalid upload key')
  }

  return { normalizedKey, targetPath }
}

async function uploadLocalFile(key: string, body: Buffer | string) {
  const { normalizedKey, targetPath } = getLocalUploadPath(key)
  await mkdir(dirname(targetPath), { recursive: true })
  await writeFile(targetPath, body)
  return `/uploads/${normalizedKey}`
}

/**
 * Initialize S3/R2 client
 */
function getStorageClient(): S3Client {
  if (s3Client) return s3Client

  const endpoint = process.env.R2_ENDPOINT
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new StorageConfigurationError(
      'Cloudflare R2 is not configured. Add R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.'
    )
  }

  s3Client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  return s3Client
}

function getBucketName() {
  const bucketName = process.env.R2_BUCKET_NAME
  if (!bucketName) throw new StorageConfigurationError('R2_BUCKET_NAME not configured')
  return bucketName
}

export function getPublicFileUrl(key: string) {
  const publicBase = process.env.R2_PUBLIC_URL
  if (publicBase) return `${publicBase.replace(/\/$/, '')}/${key}`

  const endpoint = process.env.R2_ENDPOINT
  const bucketName = getBucketName()
  return `${endpoint}/${bucketName}/${key}`
}

/**
 * Upload file to R2/S3
 * @param key - File path in bucket (e.g., "courses/123/video.mp4")
 * @param body - File content (Buffer or string)
 * @param contentType - MIME type
 * @returns Public URL of uploaded file
 */
export async function uploadFile(
  key: string,
  body: Buffer | string,
  contentType: string
): Promise<string> {
  if (useLocalStorage()) {
    return uploadLocalFile(key, body)
  }

  try {
    const client = getStorageClient()
    const bucketName = getBucketName()

    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    )

    // Return public URL:
    // - Use R2_PUBLIC_URL if configured (recommended for video playback — set after enabling
    //   "Public Access" on your R2 bucket, which gives you a pub-XXXXX.r2.dev URL)
    // - Fall back to the API endpoint URL (works for admin preview, not for <video> tags from browsers)
    return getPublicFileUrl(key)
  } catch (error) {
    if (error instanceof StorageConfigurationError) throw error
    console.error('Upload error:', error)
    throw new Error('Failed to upload file')
  }
}

/**
 * Generate presigned PUT URL for direct client-to-R2 upload (bypasses Vercel size limits)
 * @param key - File path in bucket
 * @param contentType - MIME type of the file
 * @param expirationSeconds - How long URL is valid (default 3600 = 1 hour)
 * @returns Presigned URL the client can PUT the file to directly
 */
export async function generateUploadPresignedUrl(
  key: string,
  contentType: string,
  expirationSeconds: number = 3600
): Promise<string> {
  try {
    const client = getStorageClient()
    const bucketName = getBucketName()

    const url = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: expirationSeconds }
    )

    return url
  } catch (error) {
    console.error('Presigned upload URL error:', error)
    if (error instanceof StorageConfigurationError) throw error
    throw new Error('Failed to generate upload URL')
  }
}

export async function createMultipartUpload(key: string, contentType: string) {
  const client = getStorageClient()
  const response = await client.send(new CreateMultipartUploadCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType,
  }))

  if (!response.UploadId) throw new Error('R2 no devolvió un identificador para la carga multipart.')
  return response.UploadId
}

export async function generateMultipartPartPresignedUrl(key: string, uploadId: string, partNumber: number, expirationSeconds = 3600) {
  const client = getStorageClient()
  return getSignedUrl(client, new UploadPartCommand({
    Bucket: getBucketName(),
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  }), { expiresIn: expirationSeconds })
}

export async function completeMultipartUpload(key: string, uploadId: string, parts: CompletedPart[]) {
  const client = getStorageClient()
  await client.send(new CompleteMultipartUploadCommand({
    Bucket: getBucketName(),
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  }))
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  const client = getStorageClient()
  await client.send(new AbortMultipartUploadCommand({
    Bucket: getBucketName(),
    Key: key,
    UploadId: uploadId,
  }))
}

/**
 * Get signed (temporary) download URL for file
 * @param key - File path in bucket
 * @param expirationSeconds - How long URL is valid (default 3600 = 1 hour)
 * @returns Signed URL
 */
export async function getSignedDownloadUrl(
  key: string,
  expirationSeconds: number = 3600
): Promise<string> {
  try {
    const client = getStorageClient()
    const bucketName = process.env.R2_BUCKET_NAME

    if (!bucketName) {
      throw new Error('R2_BUCKET_NAME not configured')
    }

    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
      { expiresIn: expirationSeconds }
    )

    return url
  } catch (error) {
    console.error('Signed URL error:', error)
    throw new Error('Failed to generate signed URL')
  }
}

/**
 * Recover the storage key from a URL previously returned by uploadFile().
 * uploadFile() stores either `${R2_PUBLIC_URL}/${key}` or `${R2_ENDPOINT}/${bucket}/${key}`,
 * so this strips whichever base is currently configured to get back the raw key.
 * @param url - Full URL as stored in the database
 * @returns The storage key, or null if it doesn't match a known base
 */
export function getStorageKeyFromUrl(url: string): string | null {
  const bases = [process.env.R2_PUBLIC_URL, `${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}`]

  for (const base of bases) {
    if (!base) continue
    const normalizedBase = `${base.replace(/\/$/, '')}/`
    if (url.startsWith(normalizedBase)) {
      return url.slice(normalizedBase.length)
    }
  }

  return null
}

/**
 * Delete file from R2/S3
 * @param key - File path in bucket
 */
export async function deleteFile(key: string): Promise<void> {
  if (useLocalStorage()) {
    const { targetPath } = getLocalUploadPath(key)
    try {
      await unlink(targetPath)
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error
    }
    return
  }

  try {
    const client = getStorageClient()
    const bucketName = process.env.R2_BUCKET_NAME

    if (!bucketName) {
      throw new Error('R2_BUCKET_NAME not configured')
    }

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    )
  } catch (error) {
    console.error('Delete error:', error)
    throw new Error('Failed to delete file')
  }
}

/**
 * Generate unique key for uploads
 * @param courseId - Course ID
 * @param type - Content type (video, pdf, image, etc)
 * @param originalFileName - Original file name
 * @returns Generated key
 */
export function generateStorageKey(
  courseId: string,
  type: 'video' | 'pdf' | 'image' | 'certificate',
  originalFileName: string
): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  const extension = originalFileName.split('.').pop() || 'unknown'

  return `courses/${courseId}/${type}/${timestamp}-${random}.${extension}`
}

/**
 * Validate file size
 * @param sizeBytes - File size in bytes
 * @param type - Content type
 * @returns true if valid, throws error if not
 */
export function validateFileSize(sizeBytes: number, type: 'video' | 'pdf' | 'image' | 'certificate' | 'document'): boolean {
  const MB = 1024 * 1024

  const limits = {
    video: 2000 * MB,      // 2GB
    pdf: 50 * MB,          // 50MB
    image: 20 * MB,        // 20MB
    certificate: 10 * MB,  // 10MB
    document: 100 * MB,    // 100MB
  }

  const limit = limits[type]
  if (sizeBytes > limit) {
    throw new Error(`File too large. Max ${limit / MB}MB for ${type}`)
  }

  return true
}

/**
 * Validate file type
 * @param mimeType - MIME type of file
 * @param type - Content type we expect
 * @returns true if valid, throws error if not
 */
export function validateFileType(mimeType: string, type: 'video' | 'pdf' | 'image' | 'certificate' | 'document'): boolean {
  const allowedTypes = {
    video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg'],
    pdf: ['application/pdf'],
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    certificate: ['application/pdf'],
    document: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ],
  }

  const allowed = allowedTypes[type]
  if (!allowed.includes(mimeType)) {
    throw new Error(`Invalid file type. Expected ${type}`)
  }

  return true
}

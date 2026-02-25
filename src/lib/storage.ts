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

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

interface StorageConfig {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  accountId?: string
}

let s3Client: S3Client | null = null

/**
 * Initialize S3/R2 client
 */
function getStorageClient(): S3Client {
  if (s3Client) return s3Client

  const endpoint = process.env.R2_ENDPOINT
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2/S3 environment variables')
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
  try {
    const client = getStorageClient()
    const bucketName = process.env.R2_BUCKET_NAME

    if (!bucketName) {
      throw new Error('R2_BUCKET_NAME not configured')
    }

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
    const publicBase = process.env.R2_PUBLIC_URL
    if (publicBase) {
      return `${publicBase.replace(/\/$/, '')}/${key}`
    }
    const endpoint = process.env.R2_ENDPOINT
    return `${endpoint}/${bucketName}/${key}`
  } catch (error) {
    console.error('Upload error:', error)
    throw new Error('Failed to upload file')
  }
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
 * Delete file from R2/S3
 * @param key - File path in bucket
 */
export async function deleteFile(key: string): Promise<void> {
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

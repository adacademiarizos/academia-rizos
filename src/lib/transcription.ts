import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import { createReadStream } from 'fs'
import { getOpenAI } from './openai'
import { toFile } from 'openai'

// Dynamically import ffmpeg to avoid issues in environments where it's not available
async function getFfmpeg() {
  const ffmpeg = (await import('fluent-ffmpeg')).default
  const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg')
  ffmpeg.setFfmpegPath(ffmpegInstaller.path)
  return ffmpeg
}

const WHISPER_MAX_BYTES = 24 * 1024 * 1024  // 24MB (safe margin under Whisper's 25MB limit)
const SEGMENT_DURATION_SECONDS = 1200        // 20 minutes per chunk

/**
 * Extract the R2/S3 storage key from a public file URL.
 * Returns null if the URL doesn't match known patterns.
 */
export function extractKeyFromUrl(fileUrl: string): string | null {
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '')
  if (publicBase && fileUrl.startsWith(publicBase + '/')) {
    return fileUrl.slice(publicBase.length + 1)
  }
  const endpoint = process.env.R2_ENDPOINT?.replace(/\/$/, '')
  const bucket = process.env.R2_BUCKET_NAME
  if (endpoint && bucket) {
    const prefix = `${endpoint}/${bucket}/`
    if (fileUrl.startsWith(prefix)) return fileUrl.slice(prefix.length)
  }
  return null
}

/**
 * Download a file from a URL to a local temp path.
 */
async function downloadToTemp(url: string, destPath: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download video: HTTP ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()
  await fs.writeFile(destPath, Buffer.from(arrayBuffer))
}

/**
 * Extract only the audio track from a video file as MP3 at 64kbps.
 * ~0.5MB per minute — much smaller than the full video.
 */
function extractAudioToMp3(inputPath: string, outputPath: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const ffmpeg = await getFfmpeg()
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate('64k')
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(new Error(`ffmpeg audio extraction failed: ${err.message}`)))
        .run()
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Send a single audio/video file (≤24MB) to OpenAI Whisper and return the transcript.
 */
async function callWhisper(filePath: string): Promise<string> {
  const openai = getOpenAI()
  const fileBuffer = await fs.readFile(filePath)
  const fileName = path.basename(filePath)

  const transcription = await openai.audio.transcriptions.create({
    file: await toFile(fileBuffer, fileName),
    model: 'whisper-1',
    language: 'es',
    response_format: 'text',
  })

  // When response_format is 'text', the SDK returns a string directly
  return transcription as unknown as string
}

/**
 * Split a large audio file into 20-minute segments and transcribe each one.
 */
async function transcribeChunked(audioPath: string, jobId: string): Promise<string> {
  const tmpDir = os.tmpdir()
  const segmentPattern = path.join(tmpDir, `seg-${jobId}-%03d.mp3`)

  await new Promise<void>(async (resolve, reject) => {
    try {
      const ffmpeg = await getFfmpeg()
      ffmpeg(audioPath)
        .outputOptions([
          '-f', 'segment',
          '-segment_time', String(SEGMENT_DURATION_SECONDS),
          '-c', 'copy',
        ])
        .output(segmentPattern)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(new Error(`ffmpeg segmentation failed: ${err.message}`)))
        .run()
    } catch (err) {
      reject(err)
    }
  })

  const allFiles = await fs.readdir(tmpDir)
  const segFiles = allFiles
    .filter(f => f.startsWith(`seg-${jobId}-`) && f.endsWith('.mp3'))
    .sort()

  const transcripts: string[] = []
  for (const segFile of segFiles) {
    const segPath = path.join(tmpDir, segFile)
    try {
      const t = await callWhisper(segPath)
      transcripts.push(t)
    } finally {
      await fs.unlink(segPath).catch(() => {})
    }
  }

  return transcripts.join(' ')
}

/**
 * Main transcription function.
 * Downloads the video from the given URL to /tmp, then:
 * 1. If ≤24MB: sends directly to Whisper
 * 2. If >24MB: extracts audio as MP3 (much smaller)
 * 3. If audio still >24MB: splits into 20-min chunks, transcribes each
 */
export async function transcribeVideoUrl(videoFileUrl: string): Promise<string> {
  const tmpDir = os.tmpdir()
  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const tmpVideoPath = path.join(tmpDir, `video-${jobId}.mp4`)
  const tmpAudioPath = path.join(tmpDir, `audio-${jobId}.mp3`)

  try {
    await downloadToTemp(videoFileUrl, tmpVideoPath)

    const { size: videoSize } = await fs.stat(tmpVideoPath)

    if (videoSize <= WHISPER_MAX_BYTES) {
      return await callWhisper(tmpVideoPath)
    }

    // Extract audio — much smaller than the full video
    await extractAudioToMp3(tmpVideoPath, tmpAudioPath)
    const { size: audioSize } = await fs.stat(tmpAudioPath)

    if (audioSize <= WHISPER_MAX_BYTES) {
      return await callWhisper(tmpAudioPath)
    }

    // Audio still over limit — chunk it
    return await transcribeChunked(tmpAudioPath, jobId)
  } finally {
    await fs.unlink(tmpVideoPath).catch(() => {})
    await fs.unlink(tmpAudioPath).catch(() => {})
  }
}

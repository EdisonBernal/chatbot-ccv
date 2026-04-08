import { execFile } from 'child_process'
import { writeFile, readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

/**
 * Convert audio buffer to OGG Opus format using ffmpeg.
 * OGG Opus (audio/ogg; codecs=opus) is WhatsApp's native voice message format.
 * Browsers record as audio/webm or audio/mp4 which need conversion.
 */
export async function convertAudioForWhatsApp(
  buffer: Buffer,
  contentType: string
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  const baseType = contentType.split(';')[0].trim().toLowerCase()

  // Already OGG Opus — no conversion needed
  if (baseType === 'audio/ogg') {
    return { buffer, contentType: 'audio/ogg', extension: 'ogg' }
  }

  try {
    const ffmpegPath = getFfmpegPath()
    if (!ffmpegPath) {
      console.warn('[convert-audio] ffmpeg not found, returning original')
      return { buffer, contentType: baseType, extension: getExtension(baseType) }
    }

    const id = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const inputExt = getExtension(baseType)
    const inputPath = path.join(tmpdir(), `${id}_input.${inputExt}`)
    const outputPath = path.join(tmpdir(), `${id}_output.ogg`)

    await writeFile(inputPath, buffer)
    console.log(`[convert-audio] Input: ${baseType}, ${buffer.length} bytes, ext=${inputExt}`)

    await new Promise<void>((resolve, reject) => {
      execFile(
        ffmpegPath,
        [
          '-y',
          '-i', inputPath,
          '-vn',
          '-af', [
            'highpass=f=80',
            'lowpass=f=7500',
            'acompressor=threshold=-30dB:ratio=3:attack=5:release=200:makeup=12',
            'dynaudnorm=f=150:g=15',
          ].join(','),
          '-c:a', 'libopus',
          '-b:a', '64k',
          '-ar', '48000',
          '-ac', '1',
          '-application', 'voip',
          outputPath,
        ],
        { timeout: 30000 },
        (error, _stdout, stderr) => {
          if (error) {
            console.error('[convert-audio] ffmpeg error:', stderr || error.message)
            reject(error)
          } else {
            if (stderr) console.log('[convert-audio] ffmpeg info:', stderr.split('\n').slice(-3).join(' | '))
            resolve()
          }
        }
      )
    })

    const convertedBuffer = await readFile(outputPath)
    console.log(`[convert-audio] Output: audio/ogg, ${convertedBuffer.length} bytes`)
    unlink(inputPath).catch(() => {})
    unlink(outputPath).catch(() => {})

    return { buffer: convertedBuffer, contentType: 'audio/ogg', extension: 'ogg' }
  } catch (err) {
    console.error('[convert-audio] Conversion failed, returning original:', err)
    return { buffer, contentType: baseType, extension: getExtension(baseType) }
  }
}

function getFfmpegPath(): string | null {
  // 1. Try resolving the actual binary from ffmpeg-static package
  //    Next.js bundler rewrites require('ffmpeg-static') to a wrong \ROOT\ path,
  //    so we resolve the package directory manually via require.resolve on its package.json
  try {
    const pkgPath = require.resolve('ffmpeg-static/package.json')
    const dir = path.dirname(pkgPath)
    const bin = path.join(dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
    const fs = require('fs')
    if (fs.existsSync(bin)) return bin
  } catch {
    // not installed
  }

  // 2. Try the process.cwd() based path (works in dev and production)
  try {
    const fs = require('fs')
    const candidates = [
      path.join(process.cwd(), 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
      path.join(process.cwd(), 'node_modules', '.pnpm', 'ffmpeg-static@5.3.0', 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
    ]
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate
    }
  } catch {
    // ignore
  }

  // 3. Fallback to system ffmpeg
  try {
    const { execFileSync } = require('child_process')
    const result = process.platform === 'win32'
      ? execFileSync('where', ['ffmpeg'], { encoding: 'utf8', timeout: 5000 }).trim().split('\n')[0]
      : execFileSync('which', ['ffmpeg'], { encoding: 'utf8', timeout: 5000 }).trim()
    return result || null
  } catch {
    return null
  }
}

function getExtension(contentType: string): string {
  const map: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/aac': 'aac',
    'audio/amr': 'amr',
    'audio/webm': 'webm',
    'audio/wav': 'wav',
  }
  return map[contentType] || 'bin'
}

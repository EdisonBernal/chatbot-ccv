import { execFile, execFileSync } from 'child_process'
import { writeFile, readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import fs from 'fs'

type ConvertedAudio = {
  buffer: Buffer
  contentType: string
  extension: string
}

type ProbeInfo = {
  codecName?: string
  sampleRate?: string
  channels?: number
  formatName?: string
}

export async function convertAudioForWhatsApp(
  buffer: Buffer,
  contentType: string
): Promise<ConvertedAudio> {
  const baseType = contentType.split(';')[0].trim().toLowerCase()
  const ffmpegPath = getFfmpegPath()

  if (!ffmpegPath) {
    console.warn('[convert-audio] ffmpeg not found, returning original')
    return {
      buffer,
      contentType: baseType,
      extension: getExtension(baseType),
    }
  }

  const id = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const inputExt = getExtension(baseType)
  const inputPath = path.join(tmpdir(), `${id}_input.${inputExt}`)
  const outputPath = path.join(tmpdir(), `${id}_output.ogg`)

  try {
    await writeFile(inputPath, buffer)
    console.log(`[convert-audio] Input type=${baseType}, bytes=${buffer.length}, ext=${inputExt}`)

    const beforeProbe = await probeAudio(inputPath)
    console.log('[convert-audio] Input probe:', beforeProbe)

    await runFfmpeg(ffmpegPath, inputPath, outputPath)

    const afterProbe = await probeAudio(outputPath)
    console.log('[convert-audio] Output probe:', afterProbe)

    const convertedBuffer = await readFile(outputPath)
    console.log(`[convert-audio] Output bytes=${convertedBuffer.length}`)

    return {
      buffer: convertedBuffer,
      contentType: 'audio/ogg',
      extension: 'ogg',
    }
  } catch (err) {
    console.error('[convert-audio] Conversion failed, returning original:', err)
    return {
      buffer,
      contentType: baseType,
      extension: getExtension(baseType),
    }
  } finally {
    await Promise.allSettled([
      unlink(inputPath),
      unlink(outputPath),
    ])
  }
}

async function runFfmpeg(ffmpegPath: string, inputPath: string, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile(
      ffmpegPath,
      [
        '-y',
        '-i', inputPath,
        '-vn',

        // Fuerza una base limpia y consistente antes de codificar
        '-af', 'aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=mono',

        // Codificación recomendada para voz
        '-c:a', 'libopus',
        '-application', 'voip',
        '-vbr', 'on',
        '-compression_level', '10',
        '-b:a', '24k',
        '-ar', '48000',
        '-ac', '1',

        // Hace explícito el contenedor
        '-f', 'ogg',

        // Evita ciertos problemas raros de timestamps
        '-avoid_negative_ts', 'make_zero',

        outputPath,
      ],
      { timeout: 30000, windowsHide: true },
      (error, _stdout, stderr) => {
        if (stderr) {
          console.log(
            '[convert-audio] ffmpeg log:',
            stderr.split('\n').filter(Boolean).slice(-15).join(' | ')
          )
        }

        if (error) {
          reject(error)
        } else {
          resolve()
        }
      }
    )
  })
}

async function probeAudio(filePath: string): Promise<ProbeInfo | null> {
  const ffprobePath = getFfprobePath()
  if (!ffprobePath) return null

  try {
    const result = await new Promise<string>((resolve, reject) => {
      execFile(
        ffprobePath,
        [
          '-v', 'error',
          '-select_streams', 'a:0',
          '-show_entries', 'stream=codec_name,sample_rate,channels',
          '-show_entries', 'format=format_name',
          '-of', 'json',
          filePath,
        ],
        { timeout: 10000, windowsHide: true },
        (error, stdout, stderr) => {
          if (error) {
            reject(stderr || error.message)
          } else {
            resolve(stdout)
          }
        }
      )
    })

    const json = JSON.parse(result)
    const stream = json?.streams?.[0]
    const format = json?.format

    return {
      codecName: stream?.codec_name,
      sampleRate: stream?.sample_rate,
      channels: stream?.channels,
      formatName: format?.format_name,
    }
  } catch (err) {
    console.warn('[convert-audio] ffprobe failed:', err)
    return null
  }
}

function getFfmpegPath(): string | null {
  const binName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'

  // 1. ffmpeg-static/package.json
  try {
    const pkgPath = require.resolve('ffmpeg-static/package.json')
    const dir = path.dirname(pkgPath)
    const bin = path.join(dir, binName)
    if (fs.existsSync(bin)) return bin
  } catch {}

  // 2. Posibles rutas locales
  try {
    const candidates = [
      path.join(process.cwd(), 'node_modules', 'ffmpeg-static', binName),
    ]

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate
    }
  } catch {}

  // 3. ffmpeg del sistema
  try {
    const result =
      process.platform === 'win32'
        ? execFileSync('where', ['ffmpeg'], { encoding: 'utf8', timeout: 5000 }).trim().split(/\r?\n/)[0]
        : execFileSync('which', ['ffmpeg'], { encoding: 'utf8', timeout: 5000 }).trim()

    return result || null
  } catch {
    return null
  }
}

function getFfprobePath(): string | null {
  const binName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'

  // 1. Junto a ffmpeg-static
  try {
    const pkgPath = require.resolve('ffmpeg-static/package.json')
    const dir = path.dirname(pkgPath)
    const bin = path.join(dir, binName)
    if (fs.existsSync(bin)) return bin
  } catch {}

  // 2. Ruta local
  try {
    const candidate = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', binName)
    if (fs.existsSync(candidate)) return candidate
  } catch {}

  // 3. Sistema
  try {
    const result =
      process.platform === 'win32'
        ? execFileSync('where', ['ffprobe'], { encoding: 'utf8', timeout: 5000 }).trim().split(/\r?\n/)[0]
        : execFileSync('which', ['ffprobe'], { encoding: 'utf8', timeout: 5000 }).trim()

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
    'audio/x-wav': 'wav',
    'audio/m4a': 'm4a',
    'video/webm': 'webm',
  }

  return map[contentType] || 'bin'
}

// import { execFile } from 'child_process'
// import { writeFile, readFile, unlink } from 'fs/promises'
// import { tmpdir } from 'os'
// import path from 'path'

// /**
//  * Convert audio buffer to OGG Opus format using ffmpeg.
//  * OGG Opus (audio/ogg; codecs=opus) is WhatsApp's native voice message format.
//  * Browsers record as audio/webm or audio/mp4 which need conversion.
//  */
// export async function convertAudioForWhatsApp(
//   buffer: Buffer,
//   contentType: string
// ): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
//   const baseType = contentType.split(';')[0].trim().toLowerCase()

//   // Already OGG Opus — no conversion needed
//   if (baseType === 'audio/ogg') {
//     return { buffer, contentType: 'audio/ogg', extension: 'ogg' }
//   }

//   try {
//     const ffmpegPath = getFfmpegPath()
//     if (!ffmpegPath) {
//       console.warn('[convert-audio] ffmpeg not found, returning original')
//       return { buffer, contentType: baseType, extension: getExtension(baseType) }
//     }

//     const id = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
//     const inputExt = getExtension(baseType)
//     const inputPath = path.join(tmpdir(), `${id}_input.${inputExt}`)
//     const outputPath = path.join(tmpdir(), `${id}_output.ogg`)

//     await writeFile(inputPath, buffer)
//     console.log(`[convert-audio] Input: ${baseType}, ${buffer.length} bytes, ext=${inputExt}`)

//     await new Promise<void>((resolve, reject) => {
//       execFile(
//         ffmpegPath,
//         [
//           '-y',
//           '-i', inputPath,
//           '-vn',
//           '-c:a', 'libopus',
//           '-b:a', '64k',
//           '-ar', '48000',
//           '-ac', '1',
//           '-application', 'voip',
//           outputPath,
//         ],
//         { timeout: 30000 },
//         (error, _stdout, stderr) => {
//           if (error) {
//             console.error('[convert-audio] ffmpeg error:', stderr || error.message)
//             reject(error)
//           } else {
//             if (stderr) console.log('[convert-audio] ffmpeg info:', stderr.split('\n').slice(-3).join(' | '))
//             resolve()
//           }
//         }
//       )
//     })

//     const convertedBuffer = await readFile(outputPath)
//     console.log(`[convert-audio] Output: audio/ogg (opus), ${convertedBuffer.length} bytes`)
//     unlink(inputPath).catch(() => {})
//     unlink(outputPath).catch(() => {})

//     return { buffer: convertedBuffer, contentType: 'audio/ogg', extension: 'ogg' }
//   } catch (err) {
//     console.error('[convert-audio] Conversion failed, returning original:', err)
//     return { buffer, contentType: baseType, extension: getExtension(baseType) }
//   }
// }

// function getFfmpegPath(): string | null {
//   // 1. Try resolving the actual binary from ffmpeg-static package
//   //    Next.js bundler rewrites require('ffmpeg-static') to a wrong \ROOT\ path,
//   //    so we resolve the package directory manually via require.resolve on its package.json
//   try {
//     const pkgPath = require.resolve('ffmpeg-static/package.json')
//     const dir = path.dirname(pkgPath)
//     const bin = path.join(dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
//     const fs = require('fs')
//     if (fs.existsSync(bin)) return bin
//   } catch {
//     // not installed
//   }

//   // 2. Try the process.cwd() based path (works in dev and production)
//   try {
//     const fs = require('fs')
//     const candidates = [
//       path.join(process.cwd(), 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
//       path.join(process.cwd(), 'node_modules', '.pnpm', 'ffmpeg-static@5.3.0', 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
//     ]
//     for (const candidate of candidates) {
//       if (fs.existsSync(candidate)) return candidate
//     }
//   } catch {
//     // ignore
//   }

//   // 3. Fallback to system ffmpeg
//   try {
//     const { execFileSync } = require('child_process')
//     const result = process.platform === 'win32'
//       ? execFileSync('where', ['ffmpeg'], { encoding: 'utf8', timeout: 5000 }).trim().split('\n')[0]
//       : execFileSync('which', ['ffmpeg'], { encoding: 'utf8', timeout: 5000 }).trim()
//     return result || null
//   } catch {
//     return null
//   }
// }

// function getExtension(contentType: string): string {
//   const map: Record<string, string> = {
//     'audio/ogg': 'ogg',
//     'audio/mp4': 'mp4',
//     'audio/mpeg': 'mp3',
//     'audio/mp3': 'mp3',
//     'audio/aac': 'aac',
//     'audio/amr': 'amr',
//     'audio/webm': 'webm',
//     'audio/wav': 'wav',
//   }
//   return map[contentType] || 'bin'
// }

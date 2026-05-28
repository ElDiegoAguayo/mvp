import { readFileSync } from 'fs'
import { join } from 'path'

let cachedBuffer: Buffer | null | undefined
let cachedDataUri: string | null | undefined

export function getUpCropLogoBuffer(): Buffer | null {
  if (cachedBuffer !== undefined) return cachedBuffer
  try {
    cachedBuffer = readFileSync(join(process.cwd(), 'public', 'logo-upcrop-export.png'))
    return cachedBuffer
  } catch {
    cachedBuffer = null
    return null
  }
}

export function getUpCropLogoDataUri(): string | null {
  if (cachedDataUri !== undefined) return cachedDataUri
  const buf = getUpCropLogoBuffer()
  if (!buf) {
    cachedDataUri = null
    return null
  }
  cachedDataUri = `data:image/png;base64,${buf.toString('base64')}`
  return cachedDataUri
}

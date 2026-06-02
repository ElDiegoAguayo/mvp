import type { SupabaseClient } from '@supabase/supabase-js'

/** Preferir logo sin recortar; si no hay, usar avatar_url (incl. recorte). */
export function resolveProfileLogoUrl(
  avatarUrl: string | null | undefined,
  originalUrl: string | null | undefined,
): string | null {
  const original = originalUrl?.trim()
  if (original) return original
  const avatar = avatarUrl?.trim()
  return avatar || null
}

function parsePresetAvatarsStoragePath(url: string): string | null {
  const marker = '/preset-avatars/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0])
}

function bufferToDataUri(buffer: Buffer, urlHint: string): string {
  const lower = urlHint.toLowerCase()
  const mime = lower.endsWith('.png')
    ? 'image/png'
    : lower.endsWith('.webp')
      ? 'image/webp'
      : lower.endsWith('.gif')
        ? 'image/gif'
        : 'image/jpeg'
  return `data:${mime};base64,${buffer.toString('base64')}`
}

export async function fetchImageDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png'
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length === 0) return null
    return `data:${contentType};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

/** Carga logo para @react-pdf: Storage (service) y luego fetch HTTP. */
export async function fetchProfileLogoDataUri(
  logoUrl: string,
  service: SupabaseClient | null,
): Promise<string | null> {
  const storagePath = parsePresetAvatarsStoragePath(logoUrl)
  if (service && storagePath) {
    try {
      const { data, error } = await service.storage.from('preset-avatars').download(storagePath)
      if (!error && data) {
        const buffer = Buffer.from(await data.arrayBuffer())
        if (buffer.length > 0) return bufferToDataUri(buffer, storagePath)
      }
    } catch {
      // fallback HTTP
    }
  }
  return fetchImageDataUri(logoUrl)
}

import { headers } from 'next/headers'

/** Read the caller IP from common proxy / CDN headers (server-side only). */
export async function resolveClientIp(): Promise<string | null> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return h.get('x-real-ip') ?? h.get('cf-connecting-ip') ?? h.get('x-client-ip') ?? null
}

export function normalizeIp(ip: string): string {
  return ip.trim().toLowerCase()
}

export function isSameIp(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return normalizeIp(a) === normalizeIp(b)
}

export const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|localhost|unknown)/i

/** Fallback label when no public IP is available. */
export function resolveClientIpOrUnknown(ip: string | null | undefined): string {
  const trimmed = ip?.trim()
  return trimmed || 'unknown'
}

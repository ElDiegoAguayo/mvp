/** Canonical app URL for auth redirects (invite, recovery, etc.). */
export function resolveSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`

  return 'http://localhost:3000'
}

export function buildAuthCallbackUrl(nextPath: string): string {
  const next = nextPath.startsWith('/') ? nextPath : `/${nextPath}`
  return `${resolveSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`
}

function normalizeSiteUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, '')
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  return `https://${trimmed}`
}

/** Canonical app URL for auth redirects (invite, recovery, etc.). */
export function resolveSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) return normalizeSiteUrl(fromEnv)

  // Vercel production alias (e.g. mvp.vercel.app or custom domain)
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (production) return normalizeSiteUrl(production)

  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return normalizeSiteUrl(vercel)

  return 'http://localhost:3000'
}

export function buildAuthCallbackUrl(nextPath: string): string {
  const next = nextPath.startsWith('/') ? nextPath : `/${nextPath}`
  return `${resolveSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`
}

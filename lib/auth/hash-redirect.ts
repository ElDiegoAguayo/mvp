/** Where to send the user after Supabase implicit-flow tokens in the URL hash. */
export function resolvePostAuthPath(
  type: string | null,
  nextPath?: string | null,
): string {
  if (nextPath && nextPath.startsWith('/')) {
    return nextPath
  }

  switch (type) {
    case 'invite':
    case 'signup':
      return '/auth/registro'
    case 'recovery':
      return '/auth/registro?flow=welcome'
    default:
      return '/dashboard'
  }
}

export function hashContainsAuthTokens(hash: string): boolean {
  const normalized = hash.replace(/^#/, '')
  if (!normalized) return false
  const params = new URLSearchParams(normalized)
  return params.has('access_token') || params.has('error') || params.has('error_description')
}

export function parseAuthHash(hash: string): {
  accessToken: string | null
  refreshToken: string | null
  type: string | null
  error: string | null
} {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    type: params.get('type'),
    error:
      params.get('error_description') ??
      params.get('error'),
  }
}

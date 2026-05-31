export function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const msg = 'message' in error ? String((error as { message?: string }).message ?? '') : ''
  const lower = msg.toLowerCase()
  return (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('fetch')
  )
}

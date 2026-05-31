export const LOGOUT_TRANSITION_KEY = 'upcrop-logout-transition'

export type LogoutTransitionPayload = {
  userName?: string | null
}

export function beginLogoutTransition(payload: LogoutTransitionPayload): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(LOGOUT_TRANSITION_KEY, JSON.stringify(payload))
}

export function readLogoutTransition(): LogoutTransitionPayload | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(LOGOUT_TRANSITION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as LogoutTransitionPayload
  } catch {
    return null
  }
}

export function clearLogoutTransition(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(LOGOUT_TRANSITION_KEY)
}

export function hasLogoutTransition(): boolean {
  return readLogoutTransition() !== null
}

'use client'

import { createClient } from '@/lib/supabase/client'
import {
  hashContainsAuthTokens,
  parseAuthHash,
  resolvePostAuthPath,
} from '@/lib/auth/hash-redirect'

export type CompleteAuthResult =
  | { ok: true; destination: string }
  | { ok: false; reason: string }

export async function completeAuthFromUrl(
  nextPath?: string | null,
): Promise<CompleteAuthResult> {
  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  const parsed = hashContainsAuthTokens(hash)
    ? parseAuthHash(hash)
    : { accessToken: null, refreshToken: null, type: null, error: null }

  if (parsed.error) {
    return { ok: false, reason: parsed.error }
  }

  const supabase = createClient()

  if (parsed.accessToken && parsed.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken,
    })
    if (error) {
      return { ok: false, reason: error.message }
    }
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session) {
    return {
      ok: false,
      reason:
        'Tu enlace expiró o ya fue usado. Pide una nueva invitación al administrador.',
    }
  }

  const destination = resolvePostAuthPath(parsed.type, nextPath)
  return { ok: true, destination }
}

export function redirectAfterAuth(destination: string) {
  if (typeof window === 'undefined') return
  window.history.replaceState(null, '', window.location.pathname)
  window.location.replace(destination)
}

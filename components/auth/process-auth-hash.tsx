'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  hashContainsAuthTokens,
  parseAuthHash,
  resolvePostAuthPath,
} from '@/lib/auth/hash-redirect'

/**
 * Supabase invite/magic links often redirect with tokens in the URL hash (#access_token=…).
 * Server routes never see the hash, so we establish the session on the client first.
 */
export function ProcessAuthHash() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    if (typeof window === 'undefined') return

    const hash = window.location.hash
    if (!hashContainsAuthTokens(hash)) return

    handledRef.current = true

    void (async () => {
      const { accessToken, refreshToken, type, error } = parseAuthHash(hash)
      const nextPath = searchParams.get('next')

      if (error) {
        router.replace(
          `/auth/error?reason=${encodeURIComponent(error)}`,
        )
        return
      }

      const supabase = createClient()

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (sessionError) {
          router.replace(
            `/auth/error?reason=${encodeURIComponent(sessionError.message)}`,
          )
          return
        }
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        router.replace(
          `/auth/error?reason=${encodeURIComponent(
            'Tu enlace expiró o ya fue usado. Pide una nueva invitación al administrador.',
          )}`,
        )
        return
      }

      const destination = resolvePostAuthPath(type, nextPath)
      window.history.replaceState(null, '', window.location.pathname)
      router.replace(destination)
      router.refresh()
    })()
  }, [router, searchParams])

  return null
}

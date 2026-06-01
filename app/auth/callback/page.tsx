'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { hashContainsAuthTokens } from '@/lib/auth/hash-redirect'
import {
  completeAuthFromUrl,
  redirectAfterAuth,
} from '@/lib/auth/complete-auth-client'

function AuthCallbackInner() {
  const searchParams = useSearchParams()
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    void (async () => {
      const next = searchParams.get('next')
      const code = searchParams.get('code')

      if (code) {
        const exchange = new URL('/auth/callback/exchange', window.location.origin)
        exchange.searchParams.set('code', code)
        exchange.searchParams.set('next', next ?? '/dashboard')
        window.location.replace(exchange.toString())
        return
      }

      const authError =
        searchParams.get('error_description') ??
        searchParams.get('error') ??
        searchParams.get('reason')

      if (authError) {
        window.location.replace(
          `/auth/error?reason=${encodeURIComponent(authError)}`,
        )
        return
      }

      const hash = window.location.hash
      const hasHash = hashContainsAuthTokens(hash)

      const result = await completeAuthFromUrl(next)

      if (result.ok) {
        redirectAfterAuth(result.destination)
        return
      }

      if (!hasHash) {
        window.location.replace(
          `/auth/error?reason=${encodeURIComponent(result.reason)}`,
        )
        return
      }

      window.location.replace(
        `/auth/error?reason=${encodeURIComponent(result.reason)}`,
      )
    })()
  }, [searchParams])

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="sr-only">Validando enlace de acceso…</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  )
}

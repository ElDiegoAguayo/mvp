'use client'

import { Suspense, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { hashContainsAuthTokens } from '@/lib/auth/hash-redirect'
import {
  completeAuthFromUrl,
  redirectAfterAuth,
} from '@/lib/auth/complete-auth-client'

function AuthLandingInner() {
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    void (async () => {
      const hash = window.location.hash
      const hasHash = hashContainsAuthTokens(hash)

      if (hasHash) {
        const result = await completeAuthFromUrl(null)
        if (result.ok) {
          redirectAfterAuth(result.destination)
          return
        }
        window.location.replace(
          `/auth/error?reason=${encodeURIComponent(result.reason)}`,
        )
        return
      }

      window.location.replace('/auth/login')
    })()
  }, [])

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

export function AuthLanding() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AuthLandingInner />
    </Suspense>
  )
}

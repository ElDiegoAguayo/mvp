'use client'

import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { hashContainsAuthTokens } from '@/lib/auth/hash-redirect'
import { ProcessAuthHash } from '@/components/auth/process-auth-hash'

function AuthLandingInner() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (hashContainsAuthTokens(window.location.hash)) return
    router.replace('/auth/login')
  }, [router])

  if (typeof window !== 'undefined' && hashContainsAuthTokens(window.location.hash)) {
    return (
      <>
        <ProcessAuthHash />
        <div className="fixed inset-0 flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    )
  }

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

'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { ProcessAuthHash } from '@/components/auth/process-auth-hash'
import { hashContainsAuthTokens } from '@/lib/auth/hash-redirect'

function AuthCallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const hash = window.location.hash
    if (hashContainsAuthTokens(hash)) return

    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard'

    if (code) {
      const exchange = new URL('/auth/callback/exchange', window.location.origin)
      exchange.searchParams.set('code', code)
      exchange.searchParams.set('next', next)
      window.location.replace(exchange.toString())
      return
    }

    const authError =
      searchParams.get('error_description') ??
      searchParams.get('error') ??
      searchParams.get('reason')

    if (authError) {
      router.replace(`/auth/error?reason=${encodeURIComponent(authError)}`)
      return
    }

    router.replace(
      `/auth/error?reason=${encodeURIComponent(
        'Enlace de invitación incompleto. Pide al administrador que reenvíe la invitación.',
      )}`,
    )
  }, [router, searchParams])

  return (
    <>
      <ProcessAuthHash />
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="sr-only">Validando enlace de acceso…</p>
      </div>
    </>
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

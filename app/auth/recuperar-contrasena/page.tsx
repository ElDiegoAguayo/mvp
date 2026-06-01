'use client'

import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { PasswordRecoveryForm } from '@/components/auth/password-recovery-form'
import {
  completePasswordResetAction,
  requestPasswordResetAction,
} from '@/app/auth/recuperar-contrasena-actions'
import { useLocale } from '@/components/i18n/locale-provider'

function RecuperarContrasenaContent() {
  const router = useRouter()
  const supabase = createClient()
  const { t } = useLocale()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow
    const prevBody = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prevHtml
      document.body.style.overflow = prevBody
    }
  }, [])

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setHasRecoverySession(Boolean(user))
      if (!user) {
        setError(null)
      }
      setCheckingSession(false)
    })()
  }, [supabase.auth])

  const handleRequestSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError(t('auth.recoveryEmailRequired'))
      return
    }

    setIsLoading(true)
    try {
      const result = await requestPasswordResetAction({ email: email.trim() })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setEmailSent(true)
    } catch {
      setError(t('auth.recoveryRequestFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(t('auth.passwordMin'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }

    setIsLoading(true)
    try {
      const result = await completePasswordResetAction({ password })
      if (!result.ok) {
        setError(result.message)
        return
      }

      router.replace('/dashboard')
      router.refresh()
    } catch {
      setError(t('auth.recoveryResetFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-[#4063ca]" />
      </div>
    )
  }

  return (
    <AuthPageShell>
      {hasRecoverySession ? (
        <PasswordRecoveryForm
          mode="reset"
          password={password}
          setPassword={setPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          error={error}
          isLoading={isLoading}
          onSubmit={handleResetSubmit}
        />
      ) : (
        <PasswordRecoveryForm
          mode="request"
          email={email}
          setEmail={setEmail}
          emailSent={emailSent}
          error={error}
          isLoading={isLoading}
          onSubmit={handleRequestSubmit}
        />
      )}
    </AuthPageShell>
  )
}

export default function RecuperarContrasenaPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-[#4063ca]" />
        </div>
      }
    >
      <RecuperarContrasenaContent />
    </Suspense>
  )
}

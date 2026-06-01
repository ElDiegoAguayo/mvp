'use client'

import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { RegistrationForm } from '@/components/auth/registration-form'
import { completeRegistrationAction } from '@/app/auth/registro-actions'
import { useLocale } from '@/components/i18n/locale-provider'

function RegistroContent() {
  const searchParams = useSearchParams()
  const flow = searchParams.get('flow')
  const router = useRouter()
  const supabase = createClient()
  const { t } = useLocale()

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [nameRequired, setNameRequired] = useState(true)

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
      if (!user) {
        setError(t('auth.registrationLinkExpired'))
        setCheckingSession(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()

      const existingName = profile?.full_name?.trim() ?? ''
      const metadataName =
        typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name.trim()
          : ''

      if (existingName) {
        setFullName(existingName)
      } else if (metadataName) {
        setFullName(metadataName)
      }

      setNameRequired(flow !== 'welcome' || !existingName)
      setCheckingSession(false)
    })()
  }, [supabase.auth, flow, t])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (nameRequired && !fullName.trim()) {
      setError(t('auth.fullNameRequired'))
      return
    }
    if (nameRequired && fullName.trim().length < 2) {
      setError(t('auth.fullNameMin'))
      return
    }
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
      const result = await completeRegistrationAction({
        fullName: fullName.trim(),
        password,
      })
      if (!result.ok) {
        setError(result.message)
        return
      }

      router.replace('/dashboard')
      router.refresh()
    } catch {
      setError(t('auth.registrationFailed'))
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
      <RegistrationForm
        fullName={fullName}
        setFullName={setFullName}
        password={password}
        setPassword={setPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        nameRequired={nameRequired}
        welcomeFlow={flow === 'welcome'}
        error={error}
        isLoading={isLoading}
        onSubmit={handleSubmit}
      />
    </AuthPageShell>
  )
}

export default function RegistroPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-[#4063ca]" />
        </div>
      }
    >
      <RegistroContent />
    </Suspense>
  )
}

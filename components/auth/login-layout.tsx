'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { LoginForm, UpCropLogoMark, type LoginFormProps } from '@/components/auth/login-form'
import { LogoutTransitionFinish } from '@/components/auth/logout-transition-finish'
import { useLocale } from '@/components/i18n/locale-provider'

export function LoginLayout({ isSuccess = false, welcomeName, errorKey = 0, ...props }: LoginFormProps) {
  const [shake, setShake] = useState(false)
  const { t } = useLocale()

  useEffect(() => {
    if (!props.error || errorKey === 0) return

    setShake(false)
    const raf = window.requestAnimationFrame(() => {
      setShake(true)
    })
    const timer = window.setTimeout(() => setShake(false), 750)

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [props.error, errorKey])

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

  return (
    <>
      <LogoutTransitionFinish />
      <AuthPageShell
        shake={shake}
        rootClassName={cn(isSuccess && 'login-v16-success-active')}
        contentClassName={cn(isSuccess && 'login-v16-success-out pointer-events-none')}
          overlay={
            isSuccess ? (
              <div className="login-v16-success-panel absolute inset-x-6 sm:inset-x-10 top-1/2 -translate-y-1/2 flex flex-col items-center text-center max-w-[380px] mx-auto">
                <div className="relative mb-6">
                  <span
                    className="login-v16-success-ring pointer-events-none absolute inset-0 rounded-full bg-[#4063ca]/20 dark:bg-[#6b8cff]/25"
                    aria-hidden
                  />
                  <div className="login-v16-success-icon-wrap relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#4063ca]/10 dark:bg-[#6b8cff]/15">
                    <CheckCircle2 className="h-10 w-10 text-[#4063ca] dark:text-[#6b8cff]" strokeWidth={2} />
                  </div>
                </div>
                <UpCropLogoMark size="md" className="mb-4" />
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {t('auth.welcomeSuccess', { name: welcomeName ? `, ${welcomeName}` : '' })}
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {t('auth.accessGranted')}
                </p>
              </div>
            ) : null
          }
        >
          <LoginForm isSuccess={isSuccess} {...props} />
        </AuthPageShell>
    </>
  )
}

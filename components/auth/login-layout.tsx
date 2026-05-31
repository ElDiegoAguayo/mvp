'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LOGO_ISOTYPE, LoginForm, UpCropLogoMark, type LoginFormProps } from '@/components/auth/login-form'
import { LogoutTransitionFinish } from '@/components/auth/logout-transition-finish'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { ThemeToggleButton } from '@/components/theme-toggle-float'
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
      <div
      className={cn(
        'login-page-root fixed inset-0 overflow-hidden bg-white dark:bg-slate-950',
        isSuccess && 'login-v16-success-active',
      )}
    >
      <div className="login-v16-split h-full w-full flex min-h-0 overflow-hidden bg-white dark:bg-slate-950">
        <div className="relative flex w-full lg:w-[min(520px,46%)] shrink-0 flex-col bg-white dark:bg-slate-950 min-h-0">
          <div className="login-v16-watermark login-v16-watermark-left pointer-events-none" aria-hidden>
            <Image
              src={LOGO_ISOTYPE}
              alt=""
              width={200}
              height={200}
              className="login-logo-spin-slow w-[200px] h-[200px] object-contain opacity-[0.12] dark:opacity-[0.08]"
            />
          </div>
          <div className="login-v16-watermark login-v16-watermark-right pointer-events-none" aria-hidden>
            <Image
              src={LOGO_ISOTYPE}
              alt=""
              width={160}
              height={160}
              className="login-logo-spin login-logo-spin-reverse w-[160px] h-[160px] object-contain opacity-[0.1] dark:opacity-[0.06]"
            />
          </div>

          <header className="relative z-20 flex items-center justify-between gap-2 px-4 sm:px-10 py-4 shrink-0 min-w-0">
            <UpCropLogoMark
              size="sm"
              horizontal
              className="min-w-0 shrink !flex-row !items-center !gap-2 sm:!gap-2.5"
            />
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <LanguageSwitcher className="shrink-0" />
              <a
                href="https://www.upcrop-ia.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] sm:text-xs font-medium text-[#4063ca] hover:text-[#3B5DE7] dark:text-[#6b8cff] dark:hover:text-[#8aa4ff] transition-colors whitespace-nowrap shrink-0"
              >
                <span>{t('auth.goToSite')}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
              <ThemeToggleButton size="sm" />
            </div>
          </header>

          <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 sm:px-10 pb-8 min-h-0 overflow-y-auto">
            <div
              className={cn(
                'login-v16-reveal w-full max-w-[380px] flex flex-col items-center',
                shake && 'login-v16-shake',
                isSuccess && 'login-v16-success-out pointer-events-none',
              )}
            >
              <UpCropLogoMark size="lg" className="mb-8" />
              <LoginForm isSuccess={isSuccess} {...props} />
            </div>

            {isSuccess && (
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
            )}
          </main>
        </div>

        <div className="login-v16-hero-panel relative hidden lg:flex flex-1 min-w-0 min-h-0 overflow-hidden">
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/login-hero.png"
            className="login-v16-hero-video"
            aria-label="Operaciones Up Crop"
          >
            <source src="/login-hero.mp4?v=4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-br from-[#4063ca]/10 via-transparent to-[#1e3a8a]/15 dark:from-[#4063ca]/20 dark:to-[#0f172a]/25 pointer-events-none" />
        </div>
      </div>
    </div>
    </>
  )
}

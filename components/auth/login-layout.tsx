'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { ExternalLink } from 'lucide-react'
import { LOGO_ISOTYPE, LoginForm, UpCropLogoMark, type LoginFormProps } from '@/components/auth/login-form'

export function LoginLayout(props: LoginFormProps) {
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
    <div className="login-page-root fixed inset-0 overflow-hidden bg-white dark:bg-slate-950">
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

          <header className="relative z-20 flex items-center justify-between px-6 sm:px-10 py-4 shrink-0">
            <UpCropLogoMark size="sm" horizontal className="!flex-row !items-center !gap-2.5" />
            <a
              href="https://www.upcrop-ia.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-[#4063ca] hover:text-[#3B5DE7] dark:text-[#6b8cff] dark:hover:text-[#8aa4ff] transition-colors"
            >
              <span className="hidden sm:inline">Ir al sitio</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </header>

          <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 sm:px-10 pb-8 min-h-0 overflow-y-auto">
            <div className="w-full max-w-[380px] flex flex-col items-center">
              <UpCropLogoMark size="lg" className="mb-8" />
              <LoginForm {...props} />
            </div>
          </main>
        </div>

        <div className="relative hidden lg:flex flex-1 min-w-0 min-h-0 overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/login-hero.png"
              alt="Operaciones Up Crop"
              fill
              className="object-cover"
              priority
              sizes="54vw"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-[#4063ca]/20 via-transparent to-[#1e3a8a]/25 dark:from-[#4063ca]/35 dark:to-[#0f172a]/60" />
        </div>
      </div>
    </div>
  )
}

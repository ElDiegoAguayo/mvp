'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Image from 'next/image'
import {
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldAlert,
  Eye,
  EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useLocale } from '@/components/i18n/locale-provider'

export const LOGO_ISOTYPE = '/logo-upcrop-isotype.png'

export type LoginFormProps = {
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  error: string | null
  lockoutMinutes: number | null
  isLoading: boolean
  isSuccess?: boolean
  welcomeName?: string | null
  errorKey?: number
  onSubmit: (e: FormEvent) => void
}

export function UpCropLogoMark({
  size = 'md',
  horizontal = false,
  showTagline = false,
  className,
}: {
  size?: 'sm' | 'md' | 'lg'
  horizontal?: boolean
  showTagline?: boolean
  className?: string
}) {
  const iconSize = size === 'sm' ? 36 : size === 'lg' ? 56 : 44
  const titleClass = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-xl'

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2',
        horizontal && 'flex-row !items-center !gap-2.5',
        className,
      )}
    >
      <Image
        src={LOGO_ISOTYPE}
        alt="Up Crop"
        width={iconSize}
        height={iconSize}
        className="object-contain shrink-0"
        priority
      />
      <div className={cn(horizontal ? 'text-left' : 'text-center')}>
        <p className={cn('font-bold tracking-tight text-slate-900 dark:text-slate-100', titleClass)}>
          Up <span className="text-[#4063ca] dark:text-[#6b8cff]">Crop</span>
        </p>
        {showTagline && (
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 mt-0.5">
            Agri-Tech · Exportadores
          </p>
        )}
      </div>
    </div>
  )
}

export function LoginForm({
  email,
  setEmail,
  password,
  setPassword,
  error,
  lockoutMinutes,
  isLoading,
  onSubmit,
}: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const { t } = useLocale()

  return (
    <div className="w-full max-w-[400px] space-y-5">
      <div className="space-y-1 text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">{t('auth.welcome')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('auth.signInSubtitle')}</p>
      </div>

      {error && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300">
          {lockoutMinutes ? (
            <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5" />
          )}
          <AlertDescription className="font-medium">{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-3.5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-800 dark:text-slate-200 font-medium text-sm">
            {t('auth.email')}
          </Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 dark:text-slate-500" />
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="pl-10 h-[46px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:border-[#4063ca] dark:focus:border-[#6b8cff] focus-visible:ring-[#4063ca]/20 dark:focus-visible:ring-[#6b8cff]/25"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-800 dark:text-slate-200 font-medium text-sm">
            {t('auth.password')}
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 dark:text-slate-500" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pl-10 pr-11 h-[46px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:border-[#4063ca] dark:focus:border-[#6b8cff] focus-visible:ring-[#4063ca]/20 dark:focus-visible:ring-[#6b8cff]/25"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              {showPassword ? (
                <EyeOff className="h-[18px] w-[18px]" />
              ) : (
                <Eye className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
        </div>
        <Button
          type="submit"
          disabled={isLoading || lockoutMinutes !== null}
          className={cn(
            'w-full h-[46px] font-semibold rounded-full text-[15px] transition-all',
            lockoutMinutes !== null
              ? 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed'
              : 'bg-[#4063ca] hover:bg-[#3B5DE7] dark:bg-[#4063ca] dark:hover:bg-[#5278e8] text-white shadow-sm',
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('auth.signingInAlt')}
            </>
          ) : lockoutMinutes !== null ? (
            <>
              <ShieldAlert className="mr-2 h-5 w-5" />
              {t('auth.lockout', { minutes: lockoutMinutes })}
            </>
          ) : (
            <>
              {t('auth.signInButton')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </form>

      <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500 text-center">
        {t('auth.restricted')}
      </p>
    </div>
  )
}

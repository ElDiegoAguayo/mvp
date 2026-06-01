'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useLocale } from '@/components/i18n/locale-provider'

const inputClassName =
  'pl-10 h-[46px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:border-[#4063ca] dark:focus:border-[#6b8cff] focus-visible:ring-[#4063ca]/20 dark:focus-visible:ring-[#6b8cff]/25'

type RequestFormProps = {
  mode: 'request'
  email: string
  setEmail: (value: string) => void
  emailSent: boolean
  error: string | null
  isLoading: boolean
  onSubmit: (e: FormEvent) => void
}

type ResetFormProps = {
  mode: 'reset'
  password: string
  setPassword: (value: string) => void
  confirmPassword: string
  setConfirmPassword: (value: string) => void
  error: string | null
  isLoading: boolean
  onSubmit: (e: FormEvent) => void
}

export type PasswordRecoveryFormProps = RequestFormProps | ResetFormProps

export function PasswordRecoveryForm(props: PasswordRecoveryFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const { t } = useLocale()

  if (props.mode === 'request') {
    const { email, setEmail, emailSent, error, isLoading, onSubmit } = props

    if (emailSent) {
      return (
        <div className="w-full max-w-[400px] space-y-5">
          <div className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#4063ca]/10 dark:bg-[#6b8cff]/15">
              <CheckCircle2 className="h-7 w-7 text-[#4063ca] dark:text-[#6b8cff]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {t('auth.recoveryEmailSentTitle')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('auth.recoveryEmailSentSubtitle')}
            </p>
          </div>

          <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500 text-center">
            {t('auth.recoveryEmailSentFooter')}
          </p>

          <Link
            href="/auth/login"
            className="flex items-center justify-center gap-2 text-sm font-medium text-[#4063ca] hover:text-[#3B5DE7] dark:text-[#6b8cff] dark:hover:text-[#8aa4ff] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('auth.backToLogin')}
          </Link>
        </div>
      )
    }

    return (
      <div className="w-full max-w-[400px] space-y-5">
        <div className="space-y-1 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t('auth.recoveryRequestTitle')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('auth.recoveryRequestSubtitle')}
          </p>
        </div>

        {error && (
          <Alert
            variant="destructive"
            className="bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300"
          >
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <AlertDescription className="font-medium">{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="space-y-2">
            <Label
              htmlFor="recovery-email"
              className="text-slate-800 dark:text-slate-200 font-medium text-sm"
            >
              {t('auth.email')}
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 dark:text-slate-500" />
              <Input
                id="recovery-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                disabled={isLoading}
                autoComplete="email"
                className={inputClassName}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-[46px] font-semibold rounded-full text-[15px] bg-[#4063ca] hover:bg-[#3B5DE7] dark:bg-[#4063ca] dark:hover:bg-[#5278e8] text-white shadow-sm transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('auth.recoverySending')}
              </>
            ) : (
              <>
                {t('auth.recoverySendLink')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </form>

        <Link
          href="/auth/login"
          className="flex items-center justify-center gap-2 text-sm font-medium text-[#4063ca] hover:text-[#3B5DE7] dark:text-[#6b8cff] dark:hover:text-[#8aa4ff] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('auth.backToLogin')}
        </Link>
      </div>
    )
  }

  const { password, setPassword, confirmPassword, setConfirmPassword, error, isLoading, onSubmit } =
    props

  return (
    <div className="w-full max-w-[400px] space-y-5">
      <div className="space-y-1 text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('auth.recoveryResetTitle')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('auth.recoveryResetSubtitle')}
        </p>
      </div>

      {error && (
        <Alert
          variant="destructive"
          className="bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300"
        >
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <AlertDescription className="font-medium">{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-3.5">
        <div className="space-y-2">
          <Label
            htmlFor="recovery-password"
            className="text-slate-800 dark:text-slate-200 font-medium text-sm"
          >
            {t('auth.newPassword')}
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 dark:text-slate-500" />
            <Input
              id="recovery-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordMinPlaceholder')}
              required
              minLength={8}
              disabled={isLoading}
              autoComplete="new-password"
              className={cn(inputClassName, 'pr-11')}
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

        <div className="space-y-2">
          <Label
            htmlFor="recovery-confirm-password"
            className="text-slate-800 dark:text-slate-200 font-medium text-sm"
          >
            {t('auth.confirmPassword')}
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 dark:text-slate-500" />
            <Input
              id="recovery-confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              required
              minLength={8}
              disabled={isLoading}
              autoComplete="new-password"
              className={inputClassName}
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-[46px] font-semibold rounded-full text-[15px] bg-[#4063ca] hover:bg-[#3B5DE7] dark:bg-[#4063ca] dark:hover:bg-[#5278e8] text-white shadow-sm transition-all"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('auth.recoverySaving')}
            </>
          ) : (
            <>
              {t('auth.recoveryResetButton')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </form>

      <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500 text-center">
        {t('auth.recoveryResetFooter')}
      </p>
    </div>
  )
}

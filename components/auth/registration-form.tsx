'use client'

import { useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useLocale } from '@/components/i18n/locale-provider'

const inputClassName =
  'pl-10 h-[46px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-lg focus:border-[#4063ca] dark:focus:border-[#6b8cff] focus-visible:ring-[#4063ca]/20 dark:focus-visible:ring-[#6b8cff]/25'

export type RegistrationFormProps = {
  fullName: string
  setFullName: (value: string) => void
  password: string
  setPassword: (value: string) => void
  confirmPassword: string
  setConfirmPassword: (value: string) => void
  nameRequired: boolean
  welcomeFlow: boolean
  error: string | null
  isLoading: boolean
  onSubmit: (e: FormEvent) => void
}

export function RegistrationForm({
  fullName,
  setFullName,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  nameRequired,
  welcomeFlow,
  error,
  isLoading,
  onSubmit,
}: RegistrationFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const { t } = useLocale()

  const title = welcomeFlow ? t('auth.registrationWelcomeTitle') : t('auth.registrationTitle')
  const subtitle = welcomeFlow
    ? t('auth.registrationWelcomeSubtitle')
    : t('auth.registrationSubtitle')

  return (
    <div className="w-full max-w-[400px] space-y-5">
      <div className="space-y-1 text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
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
        {nameRequired && (
          <div className="space-y-2">
            <Label
              htmlFor="full-name"
              className="text-slate-800 dark:text-slate-200 font-medium text-sm"
            >
              {t('auth.fullName')}
            </Label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 dark:text-slate-500" />
              <Input
                id="full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('auth.fullNamePlaceholder')}
                required
                minLength={2}
                disabled={isLoading}
                autoComplete="name"
                className={inputClassName}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label
            htmlFor="password"
            className="text-slate-800 dark:text-slate-200 font-medium text-sm"
          >
            {t('auth.newPassword')}
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 dark:text-slate-500" />
            <Input
              id="password"
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
            htmlFor="confirm-password"
            className="text-slate-800 dark:text-slate-200 font-medium text-sm"
          >
            {t('auth.confirmPassword')}
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 dark:text-slate-500" />
            <Input
              id="confirm-password"
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
              {t('auth.activatingAccount')}
            </>
          ) : (
            <>
              {t('auth.activateAccount')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </form>

      <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500 text-center">
        {t('auth.registrationFooter')}
      </p>
    </div>
  )
}

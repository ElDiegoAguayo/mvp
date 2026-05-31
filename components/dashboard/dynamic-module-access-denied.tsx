'use client'

import Link from 'next/link'
import { ShieldAlert, ArrowLeft, AlertTriangle } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'

interface DynamicModuleAccessDeniedProps {
  reason: 'missing' | 'forbidden' | 'error'
  moduleName?: string
  errorMessage?: string
}

export function DynamicModuleAccessDenied({
  reason,
  moduleName,
  errorMessage,
}: DynamicModuleAccessDeniedProps) {
  const { t } = useLocale()

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center">
        <div className="w-14 h-14 rounded-xl bg-destructive/15 border border-destructive/30 flex items-center justify-center mx-auto mb-4">
          {reason === 'error' ? (
            <AlertTriangle className="w-7 h-7 text-destructive" />
          ) : (
            <ShieldAlert className="w-7 h-7 text-destructive" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {reason === 'error' ? t('dynamicModule.accessDenied.errorTitle') : t('dynamicModule.accessDenied.deniedTitle')}
        </h1>
        <p className="text-muted-foreground mb-6">
          {reason === 'missing'
            ? t('dynamicModule.accessDenied.missing')
            : reason === 'forbidden'
              ? t('dynamicModule.accessDenied.forbidden', { module: moduleName ?? '' })
              : errorMessage
                ? errorMessage.includes('.')
                  ? t(errorMessage)
                  : errorMessage
                : t('dynamicModule.accessDenied.unexpected')}
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.actions.backHome')}
        </Link>
      </div>
    </div>
  )
}

'use client'

import { useLocale } from '@/components/i18n/locale-provider'

interface ProduccionLoadErrorProps {
  message?: string | null
}

export function ProduccionLoadError({ message }: ProduccionLoadErrorProps) {
  const { t } = useLocale()
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
      <p className="text-sm text-destructive-foreground">
        {message ?? t('produccion.loadError')}
      </p>
    </div>
  )
}

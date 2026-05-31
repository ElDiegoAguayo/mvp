'use client'

import { useLocale } from '@/components/i18n/locale-provider'

export function CentroDeCostosIntro() {
  const { t } = useLocale()
  return (
    <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
      {t('costosGastos.centroDeCostos.description')}
    </p>
  )
}

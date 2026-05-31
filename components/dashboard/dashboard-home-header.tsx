'use client'

import { useLocale } from '@/components/i18n/locale-provider'

interface DashboardHomeHeaderProps {
  fullName: string
}

export function DashboardHomeHeader({ fullName }: DashboardHomeHeaderProps) {
  const { t } = useLocale()

  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-foreground mb-2 text-balance">
        {t('home.welcomeLead')}{' '}
        Up <span className="text-primary">Crop</span>,{' '}
        <span className="text-primary">{fullName}</span>
      </h1>
      <p className="text-muted-foreground">{t('home.subtitle')}</p>
    </div>
  )
}

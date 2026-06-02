'use client'

import { Store } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'

export function ProveedoresPageHeader() {
  const { t } = useLocale()

  return (
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Store className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground leading-tight">
          {t('proveedores.page.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('proveedores.page.subtitle')}
        </p>
      </div>
    </div>
  )
}

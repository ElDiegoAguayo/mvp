'use client'

import { FolderLock } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'

export function VaultPageHeader() {
  const { t } = useLocale()

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <FolderLock className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('vault.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('vault.subtitle')}</p>
        </div>
      </div>
    </div>
  )
}

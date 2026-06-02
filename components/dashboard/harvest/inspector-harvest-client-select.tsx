'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Eye } from 'lucide-react'
import type { InspectorClientOption } from '@/lib/tech-assistance/inspector-clients'
import { useLocale } from '@/components/i18n/locale-provider'

interface InspectorHarvestClientSelectProps {
  clients: InspectorClientOption[]
  value: string
  onValueChange: (clientId: string) => void
}

export function InspectorHarvestClientSelect({
  clients,
  value,
  onValueChange,
}: InspectorHarvestClientSelectProps) {
  const { t } = useLocale()
  const selectedLabel = clients.find(c => c.id === value)?.label

  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
      <CardContent className="flex flex-col gap-4 pt-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
            <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-base font-semibold text-foreground">
                {t('estimacionCosecha.inspector.title')}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t('estimacionCosecha.inspector.subtitle')}
              </p>
            </div>
            <div className="space-y-1.5 max-w-lg">
              <Label htmlFor="harvest-inspector-client">{t('estimacionCosecha.inspector.client')}</Label>
              <Select value={value} onValueChange={onValueChange}>
                <SelectTrigger
                  id="harvest-inspector-client"
                  className="h-10 bg-background border-emerald-500/30 font-medium"
                >
                  <SelectValue placeholder={t('estimacionCosecha.inspector.selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clients.length === 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {t('estimacionCosecha.inspector.noClientsAssigned')}
                </p>
              )}
            </div>
          </div>
        </div>
        {selectedLabel && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-background/80 px-3 py-2 lg:max-w-xs shrink-0">
            <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t('estimacionCosecha.inspector.viewingAsLabel')}
              </p>
              <Badge variant="secondary" className="mt-0.5 max-w-full truncate bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                {selectedLabel}
              </Badge>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t('estimacionCosecha.inspector.viewingAsHint')}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export const HARVEST_INSPECTOR_CLIENT_STORAGE_KEY = 'harvest-inspector-client-id'

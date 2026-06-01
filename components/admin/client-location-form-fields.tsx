'use client'

import { Loader2, MapPin, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocale } from '@/components/i18n/locale-provider'

export type ClientLocationFormValues = {
  name: string
  search_query: string
  lat: string
  lng: string
  radius_meters: string
}

export const emptyClientLocationForm = (): ClientLocationFormValues => ({
  name: '',
  search_query: '',
  lat: '',
  lng: '',
  radius_meters: '500',
})

interface ClientLocationFormFieldsProps {
  form: ClientLocationFormValues
  onChange: (next: ClientLocationFormValues) => void
  geocoding: boolean
  onGeocode: () => void
  disabled?: boolean
}

export function ClientLocationFormFields({
  form,
  onChange,
  geocoding,
  onGeocode,
  disabled,
}: ClientLocationFormFieldsProps) {
  const { t } = useLocale()

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-secondary/15 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MapPin className="h-4 w-4 text-primary" />
        {t('profile.locations.adminOptionalTitle')}
      </div>
      <p className="text-xs text-muted-foreground">{t('profile.locations.adminOptionalHint')}</p>

      <div className="space-y-2">
        <Label>{t('asistenciaTecnica.locations.nameLabel')}</Label>
        <Input
          value={form.name}
          onChange={e => onChange({ ...form, name: e.target.value })}
          placeholder={t('asistenciaTecnica.locations.namePlaceholder')}
          disabled={disabled}
          className="bg-background border-border"
        />
      </div>

      <div className="space-y-2">
        <Label>{t('asistenciaTecnica.locations.searchLabel')}</Label>
        <div className="flex gap-2">
          <Input
            value={form.search_query}
            onChange={e => onChange({ ...form, search_query: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), onGeocode())}
            placeholder={t('asistenciaTecnica.locations.searchPlaceholder')}
            disabled={disabled}
            className="bg-background border-border"
          />
          <Button
            type="button"
            variant="outline"
            onClick={onGeocode}
            disabled={disabled || geocoding}
            className="shrink-0"
          >
            {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {form.lat && form.lng && (
        <p className="text-xs tabular-nums text-emerald-700 dark:text-emerald-400">
          {Number(form.lat).toFixed(5)}, {Number(form.lng).toFixed(5)}
        </p>
      )}

      <div className="space-y-2">
        <Label>{t('asistenciaTecnica.locations.radiusLabel')}</Label>
        <Input
          type="number"
          min={50}
          max={50000}
          step={50}
          value={form.radius_meters}
          onChange={e => onChange({ ...form, radius_meters: e.target.value })}
          disabled={disabled}
          className="bg-background border-border"
        />
      </div>
    </div>
  )
}

export function hasClientLocationDraft(form: ClientLocationFormValues): boolean {
  return Boolean(form.name.trim() && form.lat && form.lng)
}

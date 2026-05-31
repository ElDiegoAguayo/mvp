'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, MapPin, Pencil, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import {
  deactivateTechLocationAction,
  upsertTechLocationAction,
  type TechLocationOption,
} from '@/app/actions/tech-assistance-location-actions'
import { useLocale } from '@/components/i18n/locale-provider'
import { cn } from '@/lib/utils'

interface TechAssistanceLocationsPanelProps {
  clientUserId: string | null
}

const emptyForm = () => ({
  name: '',
  search_query: '',
  lat: '',
  lng: '',
  radius_meters: '500',
})

export function TechAssistanceLocationsPanel({ clientUserId }: TechAssistanceLocationsPanelProps) {
  const { t } = useLocale()
  const supabase = createClient()
  const [locations, setLocations] = useState<TechLocationOption[]>([])
  const [loading, setLoading] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [isPending, startTransition] = useTransition()

  const loadLocations = useCallback(async () => {
    if (!clientUserId) {
      setLocations([])
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('tech_assistance_locations')
      .select('id, name, lat, lng, radius_meters, search_query')
      .eq('user_id', clientUserId)
      .eq('is_active', true)
      .order('name')
    setLocations((data ?? []) as TechLocationOption[])
    setLoading(false)
  }, [clientUserId, supabase])

  useEffect(() => {
    void loadLocations()
  }, [loadLocations])

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm())
  }

  const handleGeocode = async () => {
    const query = form.search_query.trim() || form.name.trim()
    if (!query) {
      toast.error(t('asistenciaTecnica.locations.searchRequired'))
      return
    }
    setGeocoding(true)
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (!data.ok) {
        toast.error(data.message ?? t('asistenciaTecnica.locations.geocodeFailed'))
        return
      }
      setForm(f => ({
        ...f,
        search_query: query,
        lat: String(data.lat),
        lng: String(data.lng),
        name: f.name.trim() || query.split(',')[0]?.trim() || f.name,
      }))
      toast.success(t('asistenciaTecnica.locations.geocodeSuccess'))
    } catch {
      toast.error(t('asistenciaTecnica.locations.geocodeFailed'))
    } finally {
      setGeocoding(false)
    }
  }

  const handleEdit = (loc: TechLocationOption) => {
    setEditingId(loc.id)
    setForm({
      name: loc.name,
      search_query: loc.search_query ?? '',
      lat: String(loc.lat),
      lng: String(loc.lng),
      radius_meters: String(loc.radius_meters),
    })
  }

  const handleSave = () => {
    if (!clientUserId) {
      toast.error(t('asistenciaTecnica.client.selectPlaceholder'))
      return
    }
    if (!form.name.trim() || !form.lat || !form.lng) {
      toast.error(t('asistenciaTecnica.locations.validation'))
      return
    }
    startTransition(async () => {
      const res = await upsertTechLocationAction({
        id: editingId ?? undefined,
        clientUserId,
        name: form.name,
        search_query: form.search_query || null,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        radius_meters: parseInt(form.radius_meters, 10) || 500,
      })
      if (res.ok) {
        toast.success(
          editingId
            ? t('asistenciaTecnica.locations.updated')
            : t('asistenciaTecnica.locations.saved'),
        )
        resetForm()
        await loadLocations()
      } else toast.error(res.message)
    })
  }

  if (!clientUserId) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {t('asistenciaTecnica.locations.selectClientFirst')}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">
            {editingId
              ? t('asistenciaTecnica.locations.editTitle')
              : t('asistenciaTecnica.locations.createTitle')}
          </CardTitle>
          <CardDescription>{t('asistenciaTecnica.locations.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('asistenciaTecnica.locations.nameLabel')}</Label>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={t('asistenciaTecnica.locations.namePlaceholder')}
              className="bg-secondary border-border"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t('asistenciaTecnica.locations.searchLabel')}</Label>
            <div className="flex gap-2">
              <Input
                value={form.search_query}
                onChange={e => setForm(f => ({ ...f, search_query: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), void handleGeocode())}
                placeholder={t('asistenciaTecnica.locations.searchPlaceholder')}
                className="bg-secondary border-border"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleGeocode()}
                disabled={geocoding}
                className="shrink-0"
              >
                {geocoding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">{t('asistenciaTecnica.locations.searchButton')}</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('asistenciaTecnica.locations.searchHint')}</p>
          </div>
          {form.lat && form.lng && (
            <div className="sm:col-span-2 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
                <MapPin className="h-4 w-4" />
                {t('asistenciaTecnica.locations.coordsReady')}
              </div>
              <p className="mt-1 tabular-nums text-xs text-muted-foreground">
                {Number(form.lat).toFixed(5)}, {Number(form.lng).toFixed(5)}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('asistenciaTecnica.locations.radiusLabel')}</Label>
            <Input
              type="number"
              min={50}
              max={50000}
              step={50}
              value={form.radius_meters}
              onChange={e => setForm(f => ({ ...f, radius_meters: e.target.value }))}
              className="bg-secondary border-border"
            />
            <p className="text-xs text-muted-foreground">{t('asistenciaTecnica.locations.radiusHint')}</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button onClick={handleSave} disabled={isPending} className="bg-primary">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingId ? t('common.actions.save') : t('asistenciaTecnica.locations.addButton')}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm} disabled={isPending}>
                {t('common.actions.cancel')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('asistenciaTecnica.locations.none')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('asistenciaTecnica.locations.tableName')}</TableHead>
                  <TableHead>{t('asistenciaTecnica.locations.tableCoords')}</TableHead>
                  <TableHead>{t('asistenciaTecnica.locations.tableRadius')}</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map(loc => (
                  <TableRow key={loc.id} className={cn(editingId === loc.id && 'bg-primary/5')}>
                    <TableCell className="font-medium">{loc.name}</TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {Number(loc.lat).toFixed(5)}, {Number(loc.lng).toFixed(5)}
                    </TableCell>
                    <TableCell>{loc.radius_meters} m</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(loc)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          disabled={isPending}
                          onClick={() =>
                            startTransition(async () => {
                              const res = await deactivateTechLocationAction(loc.id, clientUserId)
                              if (res.ok) {
                                toast.success(t('asistenciaTecnica.locations.deleted'))
                                await loadLocations()
                              } else toast.error(res.message)
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

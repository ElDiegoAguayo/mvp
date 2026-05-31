'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  createTechEntryAction,
  deleteTechEntryAction,
  listTechInspectorClientsAction,
  updateTechEntryAction,
} from '@/app/actions/tech-assistance-actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  billingUnitLabel,
  type TechAssistanceEntry,
  type TechBillingUnit,
} from '@/lib/tech-assistance/types'
import type { InspectorClientOption } from '@/lib/tech-assistance/inspector-clients'
import { HardHat, Loader2, MapPin, Pencil, Trash2 } from 'lucide-react'
import { useLocale } from '@/components/i18n/locale-provider'
import { TechAssistanceSchedulePanel } from '@/components/dashboard/asistencia-tecnica/tech-assistance-schedule-panel'
import {
  computeWorkHoursFromTimestamps,
  formatHoursValue,
  hoursBreakdownToFormValues,
} from '@/lib/tech-assistance/work-hours'
import {
  formatServicePeriod,
  serviceLocationDefault,
  serviceOptionLabel,
} from '@/lib/tech-assistance/service-format'
import { captureDeviceGeolocation } from '@/lib/tech-assistance/capture-geolocation'
import {
  geofenceErrorMessage,
  isWithinGeofence,
} from '@/lib/tech-assistance/geofence'
import { toGeofenceLocation } from '@/lib/tech-assistance/location-validation'
import { todayWorkDateISO, formatWorkDateLabel } from '@/lib/tech-assistance/work-date'
import type { TechAssistanceLocation, TechAssistanceService } from '@/lib/tech-assistance/types'

type InspectorServiceOption = Pick<
  TechAssistanceService,
  'id' | 'name' | 'billing_unit' | 'period_start' | 'period_end' | 'location_id' | 'location_label'
> & {
  tech_assistance_locations: TechAssistanceLocation | null
}

interface TechAssistanceInspectorViewProps {
  inspectorName: string
  userId: string
}

async function captureGeolocation(): Promise<{ lat: number; lng: number } | null> {
  return captureDeviceGeolocation()
}

function formatTime(iso: string | null | undefined, locale: 'es' | 'en') {
  if (!iso) return '—'
  const localeTag = locale === 'en' ? 'en-US' : 'es-CL'
  return new Date(iso).toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })
}

export function TechAssistanceInspectorView({
  inspectorName,
  userId,
}: TechAssistanceInspectorViewProps) {
  const { t, locale } = useLocale()
  const supabase = useMemo(() => createClient(), [])
  const [clients, setClients] = useState<InspectorClientOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [services, setServices] = useState<InspectorServiceOption[]>([])
  const [entries, setEntries] = useState<TechAssistanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const clientLabelById = useMemo(() => {
    const map = new Map<string, string>()
    clients.forEach(c => map.set(c.id, c.label))
    return map
  }, [clients])

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)

  const todayWorkDate = useMemo(() => todayWorkDateISO(), [])

  const [entryForm, setEntryForm] = useState({
    service_id: '',
    work_date: todayWorkDateISO(),
    quantity: '',
    notes: '',
    location_label: '',
    location_id: null as string | null,
    attendance_value: '1',
    regular_hours: '',
    overtime_hours: '',
    started_at: '',
    ended_at: '',
    check_in_lat: null as number | null,
    check_in_lng: null as number | null,
    check_out_lat: null as number | null,
    check_out_lng: null as number | null,
  })

  const resetEntryForm = () => {
    setEditingEntryId(null)
    setEntryForm({
      service_id: '',
      work_date: todayWorkDateISO(),
      quantity: '',
      notes: '',
      location_label: '',
      location_id: null,
      attendance_value: '1',
      regular_hours: '',
      overtime_hours: '',
      started_at: '',
      ended_at: '',
      check_in_lat: null,
      check_in_lng: null,
      check_out_lat: null,
      check_out_lng: null,
    })
  }

  const loadClients = useCallback(async () => {
    const res = await listTechInspectorClientsAction()
    if (!res.ok) {
      toast.error(res.message)
      return []
    }
    setClients(res.clients)
    return res.clients
  }, [])

  const loadServices = useCallback(
    async (clientId: string) => {
      if (!clientId) {
        setServices([])
        return
      }
      const { data } = await supabase
        .from('tech_assistance_services')
        .select(
          'id, name, billing_unit, period_start, period_end, location_id, location_label, tech_assistance_locations(id, name, lat, lng, radius_meters)',
        )
        .eq('user_id', clientId)
        .eq('is_active', true)
        .order('name')
      setServices((data ?? []) as InspectorServiceOption[])
    },
    [supabase],
  )

  const loadEntries = useCallback(async () => {
    const { data } = await supabase
      .from('tech_assistance_entries')
      .select('*, tech_assistance_services(name)')
      .eq('created_by', userId)
      .order('work_date', { ascending: false })
      .limit(50)

    const rows = (data ?? []) as TechAssistanceEntry[]
    setEntries(rows)

    const missingIds = [...new Set(rows.map(e => e.user_id))]
    if (missingIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', missingIds)
      if (profiles?.length) {
        setClients(prev => {
          const next = [...prev]
          for (const p of profiles) {
            if (!next.some(c => c.id === p.id)) {
              next.push({
                id: p.id as string,
                label: (p.full_name as string)?.trim() || (p.email as string) || (p.id as string),
              })
            }
          }
          return next
        })
      }
    }
  }, [supabase, userId])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const list = await loadClients()
      if (list.length > 0) {
        setSelectedClientId(list[0].id)
      }
      await loadEntries()
      setLoading(false)
    })()
  }, [loadClients, loadEntries])

  useEffect(() => {
    if (!selectedClientId) return
    void loadServices(selectedClientId)
    setEntryForm(f => ({ ...f, service_id: '' }))
  }, [selectedClientId, loadServices])

  const applyServiceToEntryForm = (serviceId: string) => {
    const svc = services.find(s => s.id === serviceId)
    const { label, locationId } = svc ? serviceLocationDefault(svc) : { label: '', locationId: null }
    setEntryForm(f => ({
      ...f,
      service_id: serviceId,
      ...(label ? { location_label: label } : {}),
      location_id: locationId,
    }))
  }

  const selectedService = useMemo(
    () => services.find(s => s.id === entryForm.service_id),
    [services, entryForm.service_id],
  )

  const activeGeofence = useMemo(() => {
    const loc = selectedService?.tech_assistance_locations
    return loc ? toGeofenceLocation(loc) : null
  }, [selectedService])

  const validateGpsAgainstGeofence = (lat: number, lng: number): boolean => {
    if (!activeGeofence) {
      toast.error(t('asistenciaTecnica.geofence.noLocationOnService'))
      return false
    }
    if (!isWithinGeofence(lat, lng, activeGeofence.lat, activeGeofence.lng, activeGeofence.radius_meters)) {
      toast.error(geofenceErrorMessage(activeGeofence, lat, lng, locale))
      return false
    }
    return true
  }

  const handleCheckIn = async () => {
    if (!entryForm.service_id) {
      toast.error(t('asistenciaTecnica.inspector.selectLabor'))
      return
    }
    const loc = await captureGeolocation()
    if (!loc) {
      toast.error(t('asistenciaTecnica.geo.failed'))
      return
    }
    if (!validateGpsAgainstGeofence(loc.lat, loc.lng)) return
    const now = new Date()
    setEntryForm(f => ({
      ...f,
      started_at: now.toISOString(),
      check_in_lat: loc.lat,
      check_in_lng: loc.lng,
      attendance_value: f.attendance_value || '1',
    }))
    toast.success(t('asistenciaTecnica.correction.checkInSuccess'))
  }

  const handleCheckOut = async () => {
    const loc = await captureGeolocation()
    if (!loc) {
      toast.error(t('asistenciaTecnica.geo.failedShort'))
      return
    }
    if (!validateGpsAgainstGeofence(loc.lat, loc.lng)) return
    const ended_at = new Date().toISOString()
    setEntryForm(f => {
      const hours = hoursBreakdownToFormValues(
        computeWorkHoursFromTimestamps(f.started_at, ended_at),
      )
      return {
        ...f,
        ended_at,
        check_out_lat: loc.lat,
        check_out_lng: loc.lng,
        ...hours,
      }
    })
    toast.success(t('asistenciaTecnica.correction.checkOutSuccess'))
  }

  const handleEditEntry = (entry: TechAssistanceEntry) => {
    const autoHours = hoursBreakdownToFormValues(
      computeWorkHoursFromTimestamps(entry.started_at, entry.ended_at),
    )
    setEditingEntryId(entry.id)
    setSelectedClientId(entry.user_id)
    setEntryForm({
      service_id: entry.service_id,
      work_date: entry.work_date,
      quantity: entry.quantity ? String(entry.quantity) : '',
      notes: entry.notes ?? '',
      location_label: entry.location_label ?? '',
      location_id: entry.location_id ?? null,
      attendance_value: String(entry.attendance_value ?? 1),
      regular_hours: entry.regular_hours != null ? String(entry.regular_hours) : autoHours.regular_hours,
      overtime_hours: entry.overtime_hours != null ? String(entry.overtime_hours) : autoHours.overtime_hours,
      started_at: entry.started_at ?? '',
      ended_at: entry.ended_at ?? '',
      check_in_lat: entry.check_in_lat,
      check_in_lng: entry.check_in_lng,
      check_out_lat: entry.check_out_lat,
      check_out_lng: entry.check_out_lng,
    })
  }

  const handleSaveEntry = () => {
    if (!selectedClientId) {
      toast.error(t('asistenciaTecnica.client.selectWorking'))
      return
    }
    if (!entryForm.service_id) {
      toast.error(t('asistenciaTecnica.inspector.selectLabor'))
      return
    }
    if (!entryForm.check_in_lat) {
      toast.error(t('asistenciaTecnica.inspector.gpsRequired'))
      return
    }
    const computedHours = computeWorkHoursFromTimestamps(entryForm.started_at, entryForm.ended_at)
    const entryPayload = {
      service_id: entryForm.service_id,
      work_date: todayWorkDate,
      quantity: parseFloat(entryForm.quantity) || 0,
      location_label: entryForm.location_label,
      location_id: entryForm.location_id,
      attendance_value: parseFloat(entryForm.attendance_value) || 1,
      regular_hours: computedHours?.regularHours ?? null,
      overtime_hours: computedHours?.overtimeHours ?? null,
      notes: entryForm.notes,
      started_at: entryForm.started_at || null,
      ended_at: entryForm.ended_at || null,
      check_in_lat: entryForm.check_in_lat,
      check_in_lng: entryForm.check_in_lng,
      check_out_lat: entryForm.check_out_lat,
      check_out_lng: entryForm.check_out_lng,
    }

    startTransition(async () => {
      const res = editingEntryId
        ? await updateTechEntryAction({ id: editingEntryId, ...entryPayload })
        : await createTechEntryAction({
            clientUserId: selectedClientId,
            inspector_name: inspectorName,
            ...entryPayload,
          })
      if (res.ok) {
        toast.success(
          editingEntryId
            ? t('asistenciaTecnica.correction.entryUpdated')
            : t('asistenciaTecnica.inspector.entrySaved'),
        )
        resetEntryForm()
        await loadEntries()
      } else toast.error(res.message)
    })
  }

  if (loading && !clients.length) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('asistenciaTecnica.loadingShort')}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20">
              <HardHat className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('asistenciaTecnica.inspector.myAssistance')}</CardTitle>
              <CardDescription>
                {t('asistenciaTecnica.inspector.greeting', { name: inspectorName })}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('asistenciaTecnica.client.today')}</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder={t('asistenciaTecnica.client.selectPlaceholder')} />
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
              <p className="text-xs text-muted-foreground">
                {t('asistenciaTecnica.client.noClientsAssigned')}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('common.labels.date')}</Label>
              <div className="flex min-h-10 items-center rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium capitalize">
                {formatWorkDateLabel(todayWorkDate, locale)}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('asistenciaTecnica.inspector.todayOnlyHint')}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t('asistenciaTecnica.inspector.laborLabel')}</Label>
              <Select
                value={entryForm.service_id}
                onValueChange={applyServiceToEntryForm}
                disabled={!selectedClientId}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder={t('asistenciaTecnica.inspector.laborPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {services.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {serviceOptionLabel(s, locale)} ({billingUnitLabel(s.billing_unit, t)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedService && formatServicePeriod(selectedService, locale) && (
                <p className="text-xs text-muted-foreground">
                  {t('asistenciaTecnica.services.periodHint')}:{' '}
                  {formatServicePeriod(selectedService, locale)}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => void handleCheckIn()}
              disabled={!entryForm.service_id}
              className="h-14 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
            >
              <MapPin className="mr-2 h-5 w-5 text-emerald-600" />
              {t('asistenciaTecnica.inspector.checkIn')}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => void handleCheckOut()}
              disabled={!entryForm.started_at || !entryForm.service_id}
              className="h-14 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
            >
              <MapPin className="mr-2 h-5 w-5 text-amber-600" />
              {t('asistenciaTecnica.inspector.checkOut')}
            </Button>
          </div>

          <TechAssistanceSchedulePanel
            startedAt={entryForm.started_at}
            endedAt={entryForm.ended_at}
          />

          {activeGeofence && (
            <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-sm">
              <p className="font-medium text-sky-800 dark:text-sky-300">
                {t('asistenciaTecnica.geofence.mustBeNear', { name: activeGeofence.name })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('asistenciaTecnica.geofence.radiusInfo', { meters: activeGeofence.radius_meters })}
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('asistenciaTecnica.inspector.progressLabel')}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={entryForm.quantity}
                onChange={e => setEntryForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder={t('asistenciaTecnica.inspector.progressPlaceholder')}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('common.labels.location')}</Label>
              <Input
                value={entryForm.location_label}
                readOnly
                className="bg-secondary border-border read-only:opacity-90"
              />
              <p className="text-xs text-muted-foreground">{t('asistenciaTecnica.geofence.locationFromService')}</p>
            </div>
            <div className="space-y-2">
              <Label>{t('asistenciaTecnica.planilla.headers.attendance')}</Label>
              <Input
                type="number"
                min={0}
                step="0.1"
                value={entryForm.attendance_value}
                onChange={e => setEntryForm(f => ({ ...f, attendance_value: e.target.value }))}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('asistenciaTecnica.inspector.notesOptional')}</Label>
              <Input
                value={entryForm.notes}
                onChange={e => setEntryForm(f => ({ ...f, notes: e.target.value }))}
                className="bg-secondary border-border"
              />
            </div>
          </div>

          <Button
            onClick={handleSaveEntry}
            disabled={isPending || !selectedClientId || !services.length}
            className="w-full bg-primary"
            size="lg"
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editingEntryId
              ? t('asistenciaTecnica.correction.updateRecord')
              : t('asistenciaTecnica.correction.saveAssistance')}
          </Button>
          {editingEntryId && (
            <Button type="button" variant="outline" className="w-full" onClick={resetEntryForm}>
              {t('asistenciaTecnica.correction.cancelEdit')}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">{t('asistenciaTecnica.inspector.myRecords')}</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('asistenciaTecnica.correction.noRecords')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.labels.date')}</TableHead>
                    <TableHead>{t('common.labels.client')}</TableHead>
                    <TableHead>{t('asistenciaTecnica.inspector.tableLabor')}</TableHead>
                    <TableHead>{t('asistenciaTecnica.inspector.tableProgress')}</TableHead>
                    <TableHead>{t('common.labels.location')}</TableHead>
                    <TableHead>{t('asistenciaTecnica.inspector.tableSchedule')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map(e => (
                    <TableRow key={e.id}>
                      <TableCell>{e.work_date}</TableCell>
                      <TableCell className="max-w-[120px] truncate">
                        {clientLabelById.get(e.user_id) ?? t('asistenciaTecnica.dash')}
                      </TableCell>
                      <TableCell>{e.tech_assistance_services?.name ?? t('asistenciaTecnica.dash')}</TableCell>
                      <TableCell>
                        {e.quantity}{' '}
                        {e.billing_unit === 'hectare'
                          ? t('common.units.ha')
                          : t('common.units.days')}
                      </TableCell>
                      <TableCell className="max-w-[100px] truncate">
                        {e.location_label || t('asistenciaTecnica.dash')}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        <div>{formatTime(e.started_at, locale)} – {formatTime(e.ended_at, locale)}</div>
                        {(() => {
                          const hours = computeWorkHoursFromTimestamps(e.started_at, e.ended_at)
                          if (!hours) return null
                          return (
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {t('asistenciaTecnica.correction.regularHours')}:{' '}
                              {formatHoursValue(hours.regularHours, locale)} ·{' '}
                              {t('asistenciaTecnica.correction.overtimeHours')}:{' '}
                              {formatHoursValue(hours.overtimeHours, locale)}
                            </div>
                          )
                        })()}
                      </TableCell>
                      <TableCell>
                        {!e.proforma_id && e.work_date === todayWorkDate && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              disabled={isPending}
                              title={t('asistenciaTecnica.inspector.completeRecordTooltip')}
                              onClick={() => handleEditEntry(e)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-destructive"
                              disabled={isPending}
                              onClick={() =>
                                startTransition(async () => {
                                  const res = await deleteTechEntryAction(e.id)
                                  if (res.ok) {
                                    toast.success(t('asistenciaTecnica.inspector.recordDeleted'))
                                    await loadEntries()
                                  } else toast.error(res.message)
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  approveTechProformaAction,
  createTechEntryAction,
  deleteTechEntryAction,
  generateTechProformaAction,
  rejectTechProformaAction,
  sendTechProformaForApprovalAction,
  updateTechEntryAction,
  upsertTechServiceAction,
} from '@/app/actions/tech-assistance-actions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  calculateTechAmounts,
  formatCLP,
  proformaStatusLabel,
  type TechAssistanceEntry,
  type TechAssistanceProforma,
  type TechAssistanceService,
  type TechAssistanceLocation,
  type TechBillingUnit,
} from '@/lib/tech-assistance/types'
import { getEffectiveUserId } from '@/lib/supabase/effective-user'
import {
  Check,
  FileSpreadsheet,
  HardHat,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Receipt,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLocale } from '@/components/i18n/locale-provider'
import { TechAssistancePlanillaTable } from '@/components/dashboard/asistencia-tecnica/tech-assistance-planilla-table'
import { TechAssistanceSchedulePanel } from '@/components/dashboard/asistencia-tecnica/tech-assistance-schedule-panel'
import { TechAssistanceLocationsPanel } from '@/components/dashboard/asistencia-tecnica/tech-assistance-locations-panel'
import { defaultClientLocationId } from '@/lib/tech-assistance/location-validation'
import { exportPlanillaExcel } from '@/lib/tech-assistance/export-planilla-excel'
import {
  formatServicePeriod,
  serviceLocationDefault,
  serviceOptionLabel,
} from '@/lib/tech-assistance/service-format'
import {
  computeWorkHoursFromTimestamps,
  hoursBreakdownToFormValues,
} from '@/lib/tech-assistance/work-hours'

export interface TechAssistanceClientOption {
  id: string
  label: string
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const tzOffset = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
}

function fromDatetimeLocalValue(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}

const emptyEntryForm = () => ({
  service_id: '',
  work_date: todayISO(),
  inspector_name: '',
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

interface TechAssistanceManagerProps {
  mode: 'admin' | 'client'
  canApproveProformas?: boolean
  clients?: TechAssistanceClientOption[]
}

export function TechAssistanceManager({
  mode,
  canApproveProformas = false,
  clients = [],
}: TechAssistanceManagerProps) {
  const { t, locale } = useLocale()
  const isAdmin = mode === 'admin'
  const isClientView = mode === 'client'
  const supabase = useMemo(() => createClient(), [])
  const [clientUserId, setClientUserId] = useState<string>('')
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [services, setServices] = useState<TechAssistanceService[]>([])
  const [entries, setEntries] = useState<TechAssistanceEntry[]>([])
  const [proformas, setProformas] = useState<TechAssistanceProforma[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [serviceForm, setServiceForm] = useState({
    name: '',
    billing_unit: 'hectare' as TechBillingUnit,
    unit_price_net: '',
    period_start: '',
    period_end: '',
    location_id: '',
  })

  const resetServiceForm = () => {
    setEditingServiceId(null)
    setServiceForm({
      name: '',
      billing_unit: 'hectare',
      unit_price_net: '',
      period_start: '',
      period_end: '',
      location_id: defaultClientLocationId(locations),
    })
  }

  const [locations, setLocations] = useState<TechAssistanceLocation[]>([])

  const applyServiceToEntryForm = (serviceId: string) => {
    const svc = services.find(s => s.id === serviceId)
    if (!svc) return
    const { label, locationId } = serviceLocationDefault(svc)
    setEntryForm(f => ({
      ...f,
      service_id: serviceId,
      ...(label ? { location_label: label } : {}),
      ...(locationId ? { location_id: locationId } : { location_id: null }),
    }))
  }

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [selectedProformaId, setSelectedProformaId] = useState<string | null>(null)

  const [entryForm, setEntryForm] = useState(emptyEntryForm())

  const [proformaRange, setProformaRange] = useState({
    period_start: todayISO(),
    period_end: todayISO(),
  })

  const effectiveClientId = isAdmin && clientUserId ? clientUserId : ownerId

  const loadData = useCallback(async () => {
    setLoading(true)
    const { effectiveUserId } = await getEffectiveUserId(supabase)
    const targetId = isAdmin && clientUserId ? clientUserId : effectiveUserId
    setOwnerId(effectiveUserId)
    if (!targetId) {
      setLoading(false)
      return
    }

    const [servicesRes, locationsRes, entriesRes, proformasRes] = await Promise.all([
      supabase
        .from('tech_assistance_services')
        .select('*, tech_assistance_locations(id, name, lat, lng, radius_meters, search_query)')
        .eq('user_id', targetId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('tech_assistance_locations')
        .select('id, name, lat, lng, radius_meters, search_query')
        .eq('user_id', targetId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('tech_assistance_entries')
        .select('*, tech_assistance_services(name)')
        .eq('user_id', targetId)
        .order('work_date', { ascending: false })
        .limit(100),
      supabase
        .from('tech_assistance_proformas')
        .select('*')
        .eq('user_id', targetId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    setServices((servicesRes.data ?? []) as TechAssistanceService[])
    setLocations((locationsRes.data ?? []) as TechAssistanceLocation[])
    setEntries((entriesRes.data ?? []) as TechAssistanceEntry[])
    setProformas((proformasRes.data ?? []) as TechAssistanceProforma[])
    setLoading(false)
  }, [supabase, isAdmin, clientUserId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const autoId = defaultClientLocationId(locations)
    if (!autoId || editingServiceId) return
    setServiceForm(f => (f.location_id === autoId ? f : { ...f, location_id: autoId }))
  }, [locations, editingServiceId])

  useEffect(() => {
    if (isAdmin && clients.length && !clientUserId) {
      setClientUserId(clients[0].id)
    }
  }, [isAdmin, clients, clientUserId])

  const previewAmounts = useMemo(() => {
    const svc = services.find(s => s.id === entryForm.service_id)
    const qty = parseFloat(entryForm.quantity) || 0
    const price = svc ? Number(svc.unit_price_net) : 0
    return calculateTechAmounts(qty, price)
  }, [entryForm.service_id, entryForm.quantity, services])

  const clientLabel = useMemo(() => {
    if (isAdmin && clientUserId) {
      return clients.find(c => c.id === clientUserId)?.label
    }
    return undefined
  }, [isAdmin, clientUserId, clients])

  const proformaEntries = useMemo(() => {
    if (!selectedProformaId) return []
    return entries.filter(e => e.proforma_id === selectedProformaId)
  }, [entries, selectedProformaId])

  const selectedProforma = useMemo(
    () => proformas.find(p => p.id === selectedProformaId) ?? null,
    [proformas, selectedProformaId],
  )

  const handleExportPlanilla = async (rows: TechAssistanceEntry[], filename: string, title: string) => {
    if (!rows.length) {
      toast.error(t('asistenciaTecnica.export.noRecords'))
      return
    }
    try {
      await exportPlanillaExcel({
        entries: rows,
        filename,
        title,
        clientLabel,
        proforma: selectedProforma,
        t,
        locale,
      })
      toast.success(t('asistenciaTecnica.export.success'))
    } catch {
      toast.error(t('asistenciaTecnica.export.failed'))
    }
  }
  const spendingSummary = useMemo(() => {
    const open = entries.filter(e => !e.proforma_id)
    const totalOpen = open.reduce((s, e) => s + Number(e.amount_total), 0)
    const approved = proformas
      .filter(p => p.status === 'approved')
      .reduce((s, p) => s + Number(p.total_amount), 0)
    return { totalOpen, approved, openCount: open.length }
  }, [entries, proformas])

  const resolveSiteCoords = useCallback((): { lat: number; lng: number } | null => {
    const locId = entryForm.location_id
    const loc = locId ? locations.find(l => l.id === locId) : null
    const target = loc ?? locations[0] ?? null
    if (!target) return null
    return { lat: target.lat, lng: target.lng }
  }, [entryForm.location_id, locations])

  const handleCheckInTimeChange = (value: string) => {
    const started_at = fromDatetimeLocalValue(value)
    const coords = started_at ? resolveSiteCoords() : null
    setEntryForm(f => ({
      ...f,
      started_at,
      check_in_lat: started_at && coords ? coords.lat : null,
      check_in_lng: started_at && coords ? coords.lng : null,
      ...(started_at ? {} : { ended_at: '', check_out_lat: null, check_out_lng: null }),
    }))
  }

  const handleCheckOutTimeChange = (value: string) => {
    const ended_at = fromDatetimeLocalValue(value)
    setEntryForm(f => {
      const coords = ended_at ? resolveSiteCoords() : null
      const hours =
        ended_at && f.started_at
          ? hoursBreakdownToFormValues(
              computeWorkHoursFromTimestamps(f.started_at, ended_at),
            )
          : {}
      return {
        ...f,
        ended_at,
        check_out_lat: ended_at && coords ? coords.lat : null,
        check_out_lng: ended_at && coords ? coords.lng : null,
        ...hours,
      }
    })
  }

  const handleEditService = (service: TechAssistanceService) => {
    setEditingServiceId(service.id)
    setServiceForm({
      name: service.name,
      billing_unit: service.billing_unit,
      unit_price_net: String(service.unit_price_net),
      period_start: service.period_start ?? '',
      period_end: service.period_end ?? '',
      location_id: service.location_id ?? '',
    })
  }

  const handleSaveService = () => {
    if (!serviceForm.name.trim() || !serviceForm.unit_price_net) {
      toast.error(t('asistenciaTecnica.services.validation'))
      return
    }
    if (!serviceForm.location_id && !defaultClientLocationId(locations)) {
      toast.error(t('asistenciaTecnica.services.locationRequired'))
      return
    }
    const hasStart = Boolean(serviceForm.period_start)
    const hasEnd = Boolean(serviceForm.period_end)
    if (hasStart !== hasEnd) {
      toast.error(t('asistenciaTecnica.services.periodValidation'))
      return
    }
    startTransition(async () => {
      const selectedLoc =
        locations.find(l => l.id === serviceForm.location_id) ?? locations[0] ?? null
      const locationId = serviceForm.location_id || defaultClientLocationId(locations)
      const res = await upsertTechServiceAction({
        id: editingServiceId ?? undefined,
        clientUserId: effectiveClientId ?? undefined,
        name: serviceForm.name,
        billing_unit: serviceForm.billing_unit,
        unit_price_net: parseFloat(serviceForm.unit_price_net),
        period_start: serviceForm.period_start || null,
        period_end: serviceForm.period_end || null,
        location_id: locationId || null,
        location_label: selectedLoc?.name ?? null,
      })
      if (res.ok) {
        toast.success(
          editingServiceId
            ? t('asistenciaTecnica.services.updated')
            : t('asistenciaTecnica.services.saved'),
        )
        resetServiceForm()
        await loadData()
      } else toast.error(res.message)
    })
  }

  const handleEditEntry = (entry: TechAssistanceEntry) => {
    setEditingEntryId(entry.id)
    setEntryForm({
      service_id: entry.service_id,
      work_date: entry.work_date,
      inspector_name: entry.inspector_name,
      quantity: entry.quantity ? String(entry.quantity) : '',
      notes: entry.notes ?? '',
      location_label: entry.location_label ?? '',
      location_id: entry.location_id ?? null,
      attendance_value: String(entry.attendance_value ?? 1),
      regular_hours: entry.regular_hours != null ? String(entry.regular_hours) : '',
      overtime_hours: entry.overtime_hours != null ? String(entry.overtime_hours) : '',
      started_at: entry.started_at ?? '',
      ended_at: entry.ended_at ?? '',
      check_in_lat: entry.check_in_lat,
      check_in_lng: entry.check_in_lng,
      check_out_lat: entry.check_out_lat,
      check_out_lng: entry.check_out_lng,
    })
  }

  const resetEntryFormState = () => {
    setEditingEntryId(null)
    setEntryForm(emptyEntryForm())
  }

  const handleSaveEntry = () => {
    if (!entryForm.service_id || !entryForm.inspector_name.trim()) {
      toast.error(t('asistenciaTecnica.correction.validation'))
      return
    }
    const computedHours = computeWorkHoursFromTimestamps(entryForm.started_at, entryForm.ended_at)
    const entryPayload = {
      service_id: entryForm.service_id,
      work_date: entryForm.work_date,
      inspector_name: entryForm.inspector_name,
      quantity: parseFloat(entryForm.quantity) || 0,
      notes: entryForm.notes,
      location_label: entryForm.location_label,
      location_id: entryForm.location_id,
      attendance_value: parseFloat(entryForm.attendance_value) || 1,
      regular_hours: entryForm.regular_hours
        ? parseFloat(entryForm.regular_hours)
        : computedHours?.regularHours ?? null,
      overtime_hours: entryForm.overtime_hours
        ? parseFloat(entryForm.overtime_hours)
        : computedHours?.overtimeHours ?? null,
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
            clientUserId: effectiveClientId ?? undefined,
            ...entryPayload,
          })
      if (res.ok) {
        toast.success(
          editingEntryId
            ? t('asistenciaTecnica.correction.entryUpdated')
            : t('asistenciaTecnica.correction.entrySaved'),
        )
        resetEntryFormState()
        await loadData()
      } else toast.error(res.message)
    })
  }

  const handleGenerateProforma = (sendForApproval: boolean) => {
    startTransition(async () => {
      const res = await generateTechProformaAction({
        clientUserId: effectiveClientId ?? undefined,
        period_start: proformaRange.period_start,
        period_end: proformaRange.period_end,
        sendForApproval,
      })
      if (res.ok) {
        toast.success(
          sendForApproval
            ? t('asistenciaTecnica.proformas.sentToClient')
            : t('asistenciaTecnica.proformas.generated'),
        )
        await loadData()
      } else toast.error(res.message)
    })
  }

  if (loading && !services.length && !entries.length) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('asistenciaTecnica.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isAdmin && clients.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('asistenciaTecnica.client.title')}</CardTitle>
            <CardDescription>{t('asistenciaTecnica.client.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={clientUserId} onValueChange={setClientUserId}>
              <SelectTrigger className="max-w-md bg-secondary border-border">
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
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardDescription>{t('asistenciaTecnica.summary.pendingBilling')}</CardDescription>
            <CardTitle className="text-xl">{formatCLP(spendingSummary.totalOpen)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {t('asistenciaTecnica.summary.openRecords', { count: spendingSummary.openCount })}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardDescription>{t('asistenciaTecnica.summary.approvedProformas')}</CardDescription>
            <CardTitle className="text-xl">{formatCLP(spendingSummary.approved)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardDescription>{t('asistenciaTecnica.summary.vatApplied')}</CardDescription>
            <CardTitle className="text-xl">{t('asistenciaTecnica.summary.vatRate')}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {t('asistenciaTecnica.summary.vatNote')}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={isClientView ? 'planilla' : 'servicios'} className="space-y-4">
        <TabsList
          className={cn(
            'grid w-full bg-secondary',
            isClientView ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-5',
          )}
        >
          {!isClientView && (
            <TabsTrigger value="servicios" className="gap-1.5">
              <Plus className="h-4 w-4" />
              {t('asistenciaTecnica.tabs.services')}
            </TabsTrigger>
          )}
          {!isClientView && (
            <TabsTrigger value="asistencia" className="gap-1.5">
              <HardHat className="h-4 w-4" />
              {t('asistenciaTecnica.tabs.correction')}
            </TabsTrigger>
          )}
          <TabsTrigger value="planilla" className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" />
            {isClientView ? t('asistenciaTecnica.tabs.records') : t('asistenciaTecnica.tabs.planilla')}
          </TabsTrigger>
          {!isClientView && (
            <TabsTrigger value="ubicaciones" className="gap-1.5">
              <MapPin className="h-4 w-4" />
              {t('asistenciaTecnica.tabs.locations')}
            </TabsTrigger>
          )}
          <TabsTrigger value="proformas" className="gap-1.5">
            <Receipt className="h-4 w-4" />
            {t('asistenciaTecnica.tabs.proformas')}
          </TabsTrigger>
        </TabsList>

        {!isClientView && (
        <TabsContent value="servicios" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">
                {editingServiceId
                  ? t('asistenciaTecnica.services.editTitle')
                  : t('asistenciaTecnica.services.listTitle')}
              </CardTitle>
              <CardDescription>
                {editingServiceId
                  ? t('asistenciaTecnica.services.editDescription')
                  : t('asistenciaTecnica.services.createDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('asistenciaTecnica.services.nameLabel')}</Label>
                <Input
                  value={serviceForm.name}
                  onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t('asistenciaTecnica.services.namePlaceholder')}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('asistenciaTecnica.services.periodStartLabel')}</Label>
                <Input
                  type="date"
                  value={serviceForm.period_start}
                  onChange={e => setServiceForm(f => ({ ...f, period_start: e.target.value }))}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('asistenciaTecnica.services.periodEndLabel')}</Label>
                <Input
                  type="date"
                  value={serviceForm.period_end}
                  onChange={e => setServiceForm(f => ({ ...f, period_end: e.target.value }))}
                  className="bg-secondary border-border"
                />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-4 -mt-2">
                {t('asistenciaTecnica.services.periodHint')}
              </p>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('asistenciaTecnica.services.locationSelectLabel')}</Label>
                {locations.length > 0 ? (
                  <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {locations[0].name}{' '}
                        <span className="font-normal text-muted-foreground">
                          ({locations[0].radius_meters} m)
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('asistenciaTecnica.services.locationAutoAssigned')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Select
                      value={serviceForm.location_id}
                      onValueChange={v => setServiceForm(f => ({ ...f, location_id: v }))}
                      disabled
                    >
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue placeholder={t('asistenciaTecnica.services.locationSelectPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent />
                    </Select>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t('asistenciaTecnica.services.noLocationsHint')}
                    </p>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('asistenciaTecnica.services.billingTypeLabel')}</Label>
                <Select
                  value={serviceForm.billing_unit}
                  onValueChange={v => setServiceForm(f => ({ ...f, billing_unit: v as TechBillingUnit }))}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hectare">{t('asistenciaTecnica.billingUnits.perHectare')}</SelectItem>
                    <SelectItem value="day">{t('asistenciaTecnica.billingUnits.perDay')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('asistenciaTecnica.services.netPriceLabel')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={serviceForm.unit_price_net}
                  onChange={e => setServiceForm(f => ({ ...f, unit_price_net: e.target.value }))}
                  className="bg-secondary border-border"
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-4">
                <Button onClick={handleSaveService} disabled={isPending} className="bg-primary">
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingServiceId
                    ? t('asistenciaTecnica.services.saveChanges')
                    : t('asistenciaTecnica.services.addService')}
                </Button>
                {editingServiceId && (
                  <Button type="button" variant="outline" onClick={resetServiceForm} disabled={isPending}>
                    {t('common.actions.cancel')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="pt-6">
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('asistenciaTecnica.services.noneConfigured')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('asistenciaTecnica.services.tableService')}</TableHead>
                      <TableHead>{t('asistenciaTecnica.services.tablePeriod')}</TableHead>
                      <TableHead>{t('asistenciaTecnica.services.tableLocation')}</TableHead>
                      <TableHead>{t('asistenciaTecnica.services.tableBilling')}</TableHead>
                      <TableHead className="text-right">{t('asistenciaTecnica.services.tableNetPrice')}</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map(s => (
                      <TableRow
                        key={s.id}
                        className={cn(editingServiceId === s.id && 'bg-primary/5')}
                      >
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatServicePeriod(s, locale) ?? t('asistenciaTecnica.dash')}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate text-sm">
                          {s.tech_assistance_locations?.name?.trim() ||
                            s.location_label?.trim() ||
                            t('asistenciaTecnica.dash')}
                        </TableCell>
                        <TableCell>{billingUnitLabel(s.billing_unit, t)}</TableCell>
                        <TableCell className="text-right">{formatCLP(Number(s.unit_price_net))}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={t('asistenciaTecnica.services.editTooltip')}
                            onClick={() => handleEditService(s)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {!isClientView && (
        <TabsContent value="ubicaciones" className="space-y-4">
          <TechAssistanceLocationsPanel clientUserId={effectiveClientId} />
        </TabsContent>
        )}

        {!isClientView && (
        <TabsContent value="asistencia" className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">
                {editingEntryId
                  ? t('asistenciaTecnica.correction.editTitle')
                  : t('asistenciaTecnica.correction.createTitle')}
              </CardTitle>
              <CardDescription>{t('asistenciaTecnica.correction.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t('common.labels.date')}</Label>
                  <Input
                    type="date"
                    value={entryForm.work_date}
                    onChange={e => setEntryForm(f => ({ ...f, work_date: e.target.value }))}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('asistenciaTecnica.correction.inspectorLabel')}</Label>
                  <Input
                    value={entryForm.inspector_name}
                    onChange={e => setEntryForm(f => ({ ...f, inspector_name: e.target.value }))}
                    placeholder={t('asistenciaTecnica.correction.inspectorPlaceholder')}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('common.labels.service')} / labor</Label>
                  <Select
                    value={entryForm.service_id}
                    onValueChange={applyServiceToEntryForm}
                  >
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder={t('common.actions.select')} />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {serviceOptionLabel(s, locale)} ({billingUnitLabel(s.billing_unit, t)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('asistenciaTecnica.correction.quantityLabel')}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={entryForm.quantity}
                    onChange={e => setEntryForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder={t('asistenciaTecnica.correction.quantityPlaceholder')}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('common.labels.location')}</Label>
                  <Input
                    value={entryForm.location_label}
                    onChange={e => setEntryForm(f => ({ ...f, location_label: e.target.value }))}
                    placeholder={t('asistenciaTecnica.correction.locationPlaceholder')}
                    className="bg-secondary border-border"
                  />
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
                <div className="space-y-2">
                  <Label>{t('asistenciaTecnica.correction.regularHours')}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.25"
                    value={entryForm.regular_hours}
                    onChange={e => setEntryForm(f => ({ ...f, regular_hours: e.target.value }))}
                    placeholder={t('asistenciaTecnica.schedule.autoCalculated')}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('asistenciaTecnica.correction.overtimeHours')}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.25"
                    value={entryForm.overtime_hours}
                    onChange={e => setEntryForm(f => ({ ...f, overtime_hours: e.target.value }))}
                    placeholder={t('asistenciaTecnica.schedule.autoCalculated')}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>{t('common.labels.notes')}</Label>
                  <Input
                    value={entryForm.notes}
                    onChange={e => setEntryForm(f => ({ ...f, notes: e.target.value }))}
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('asistenciaTecnica.correction.checkInTime')}</Label>
                  <Input
                    type="datetime-local"
                    value={toDatetimeLocalValue(entryForm.started_at)}
                    onChange={e => handleCheckInTimeChange(e.target.value)}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('asistenciaTecnica.correction.checkOutTime')}</Label>
                  <Input
                    type="datetime-local"
                    value={toDatetimeLocalValue(entryForm.ended_at)}
                    onChange={e => handleCheckOutTimeChange(e.target.value)}
                    disabled={!entryForm.started_at}
                    className="bg-secondary border-border"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('asistenciaTecnica.correction.adminTimeHint')}
              </p>

              <TechAssistanceSchedulePanel
                startedAt={entryForm.started_at}
                endedAt={entryForm.ended_at}
              />

              {(entryForm.check_in_lat != null || entryForm.check_out_lat != null) && (
                <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">{t('asistenciaTecnica.correction.siteCoordsNote')}</p>
                  {entryForm.check_in_lat != null && (
                    <p>
                      {t('asistenciaTecnica.correction.checkInLabel')}: {entryForm.check_in_lat.toFixed(5)}, {entryForm.check_in_lng?.toFixed(5)}
                      {entryForm.started_at &&
                        ` · ${new Date(entryForm.started_at).toLocaleTimeString(locale === 'en' ? 'en-US' : 'es-CL')}`}
                    </p>
                  )}
                  {entryForm.check_out_lat != null && (
                    <p>
                      {t('asistenciaTecnica.correction.checkOutLabel')}: {entryForm.check_out_lat.toFixed(5)}, {entryForm.check_out_lng?.toFixed(5)}
                      {entryForm.ended_at &&
                        ` · ${new Date(entryForm.ended_at).toLocaleTimeString(locale === 'en' ? 'en-US' : 'es-CL')}`}
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                <p>
                  {t('asistenciaTecnica.correction.amountPreview', {
                    net: formatCLP(previewAmounts.amount_net),
                    iva: formatCLP(previewAmounts.amount_iva),
                    total: formatCLP(previewAmounts.amount_total),
                  })}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSaveEntry} disabled={isPending || !services.length}>
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingEntryId
                    ? t('asistenciaTecnica.correction.updateRecord')
                    : t('asistenciaTecnica.correction.saveAssistance')}
                </Button>
                {editingEntryId && (
                  <Button type="button" variant="outline" onClick={resetEntryFormState}>
                    {t('asistenciaTecnica.correction.cancelEdit')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('asistenciaTecnica.correction.history')}</CardTitle>
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
                        <TableHead>{t('asistenciaTecnica.correction.inspectorLabel')}</TableHead>
                        <TableHead>{t('common.labels.service')}</TableHead>
                        <TableHead>{t('asistenciaTecnica.correction.tableQty')}</TableHead>
                        <TableHead className="text-right">{t('common.labels.total')}</TableHead>
                        <TableHead>GPS</TableHead>
                        <TableHead>{t('common.labels.status')}</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map(e => (
                        <TableRow key={e.id}>
                          <TableCell>{e.work_date}</TableCell>
                          <TableCell>{e.inspector_name}</TableCell>
                          <TableCell>{e.tech_assistance_services?.name ?? t('asistenciaTecnica.dash')}</TableCell>
                          <TableCell>
                            {e.quantity}{' '}
                            {e.billing_unit === 'hectare'
                              ? t('common.units.ha')
                              : t('common.units.days')}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCLP(Number(e.amount_total))}</TableCell>
                          <TableCell>
                            {e.check_in_lat != null ? (
                              <Badge variant="outline" className="text-[10px]">
                                <MapPin className="mr-1 h-3 w-3" />
                                {t('asistenciaTecnica.correction.gpsOk')}
                              </Badge>
                            ) : (
                              t('asistenciaTecnica.dash')
                            )}
                          </TableCell>
                          <TableCell>
                            {e.proforma_id ? (
                              <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">
                                {t('asistenciaTecnica.proformas.inProforma')}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">{t('common.status.open')}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {!e.proforma_id && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  disabled={isPending}
                                  title={t('asistenciaTecnica.correction.editRecordTooltip')}
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
                                        toast.success(t('asistenciaTecnica.correction.deleted'))
                                        await loadData()
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
        </TabsContent>
        )}

        <TabsContent value="planilla" className="space-y-4">
          {isClientView && (
            <Card className="border-border bg-secondary/20">
              <CardContent className="pt-6 text-sm text-muted-foreground">
                {t('asistenciaTecnica.planilla.clientInfo')}
              </CardContent>
            </Card>
          )}
          <Card className="border-border">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">{t('asistenciaTecnica.planilla.title')}</CardTitle>
                <CardDescription>{t('asistenciaTecnica.planilla.description')}</CardDescription>
              </div>
              <Button
                variant="outline"
                disabled={!entries.length}
                onClick={() =>
                  void handleExportPlanilla(
                    entries,
                    `planilla-asistencia-${todayISO()}.xlsx`,
                    t('asistenciaTecnica.planilla.exportTitle'),
                  )
                }
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {t('asistenciaTecnica.planilla.exportExcel')}
              </Button>
            </CardHeader>
            <CardContent>
              <TechAssistancePlanillaTable entries={entries} showPrices />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proformas" className="space-y-4">
          {isAdmin && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg">{t('asistenciaTecnica.proformas.generateTitle')}</CardTitle>
                <CardDescription>{t('asistenciaTecnica.proformas.generateDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="space-y-2">
                  <Label>{t('common.labels.from')}</Label>
                  <Input
                    type="date"
                    value={proformaRange.period_start}
                    onChange={e => setProformaRange(r => ({ ...r, period_start: e.target.value }))}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('common.labels.to')}</Label>
                  <Input
                    type="date"
                    value={proformaRange.period_end}
                    onChange={e => setProformaRange(r => ({ ...r, period_end: e.target.value }))}
                    className="bg-secondary border-border"
                  />
                </div>
                <Button variant="outline" disabled={isPending} onClick={() => handleGenerateProforma(false)}>
                  {t('asistenciaTecnica.proformas.generateDraft')}
                </Button>
                <Button disabled={isPending} onClick={() => handleGenerateProforma(true)}>
                  <Send className="mr-2 h-4 w-4" />
                  {t('asistenciaTecnica.proformas.sendToClient')}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">{t('asistenciaTecnica.proformas.listTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {proformas.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('asistenciaTecnica.proformas.noneGenerated')}</p>
              ) : (
                <div className="space-y-3">
                  {proformas.map(p => (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedProformaId(prev => (prev === p.id ? null : p.id))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedProformaId(prev => (prev === p.id ? null : p.id))
                        }
                      }}
                      className={cn(
                        'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between cursor-pointer transition-colors',
                        selectedProformaId === p.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-secondary/20 hover:bg-secondary/40',
                      )}
                    >
                      <div>
                        <p className="font-semibold text-foreground">{p.proforma_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {p.period_start} → {p.period_end}
                        </p>
                        <p className="mt-1 text-sm">
                          {t('asistenciaTecnica.proformas.amountLine', {
                            net: formatCLP(Number(p.subtotal_net)),
                            iva: formatCLP(Number(p.iva_amount)),
                            total: formatCLP(Number(p.total_amount)),
                          })}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            p.status === 'approved' && 'border-emerald-500/40 text-emerald-700',
                            p.status === 'pending_approval' && 'border-amber-500/40 text-amber-700',
                          )}
                        >
                          {proformaStatusLabel(p.status, t)}
                        </Badge>
                        {p.status === 'pending_approval' && isClientView && canApproveProformas && (
                          <>
                            <Button
                              size="sm"
                              disabled={isPending}
                              onClick={e => {
                                e.stopPropagation()
                                startTransition(async () => {
                                  const res = await approveTechProformaAction(p.id)
                                  if (res.ok) {
                                    toast.success(t('asistenciaTecnica.proformas.approved'))
                                    await loadData()
                                  } else toast.error(res.message)
                                })
                              }}
                            >
                              <Check className="mr-1 h-4 w-4" />
                              {t('common.actions.approve')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isPending}
                              onClick={e => {
                                e.stopPropagation()
                                startTransition(async () => {
                                  const res = await rejectTechProformaAction(p.id)
                                  if (res.ok) {
                                    toast.success(t('asistenciaTecnica.proformas.rejected'))
                                    setSelectedProformaId(null)
                                    await loadData()
                                  } else toast.error(res.message)
                                })
                              }}
                            >
                              <X className="mr-1 h-4 w-4" />
                              {t('common.actions.reject')}
                            </Button>
                          </>
                        )}
                        {p.status === 'draft' && isAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={e => {
                              e.stopPropagation()
                              startTransition(async () => {
                                const res = await sendTechProformaForApprovalAction(p.id)
                                if (res.ok) {
                                  toast.success(t('asistenciaTecnica.proformas.sent'))
                                  await loadData()
                                } else toast.error(res.message)
                              })
                            }}
                          >
                            <Send className="mr-1 h-4 w-4" />
                            {t('common.actions.send')}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedProformaId(p.id)
                          }}
                        >
                          {t('asistenciaTecnica.proformas.viewDetail')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedProforma && (
            <Card className="border-border border-primary/30">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {t('asistenciaTecnica.proformas.detailTitle', {
                      number: selectedProforma.proforma_number,
                    })}
                  </CardTitle>
                  <CardDescription>
                    {t('asistenciaTecnica.proformas.detailDescription', {
                      start: selectedProforma.period_start,
                      end: selectedProforma.period_end,
                      lines: proformaEntries.length,
                      total: formatCLP(Number(selectedProforma.total_amount)),
                    })}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  disabled={!proformaEntries.length}
                  onClick={() =>
                    void exportPlanillaExcel({
                      entries: proformaEntries,
                      filename: `${selectedProforma.proforma_number}.xlsx`,
                      title: t('asistenciaTecnica.proformas.exportTitle', {
                        number: selectedProforma.proforma_number,
                      }),
                      clientLabel,
                      proforma: selectedProforma,
                      t,
                      locale,
                    })
                      .then(() => toast.success(t('asistenciaTecnica.export.success')))
                      .catch(() => toast.error(t('asistenciaTecnica.export.exportError')))
                  }
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {t('asistenciaTecnica.planilla.exportExcel')}
                </Button>
              </CardHeader>
              <CardContent>
                <TechAssistancePlanillaTable entries={proformaEntries} showPrices />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

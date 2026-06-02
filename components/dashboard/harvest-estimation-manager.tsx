'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getEffectiveUserId } from '@/lib/supabase/effective-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2, Plus, Pencil, Trash2, BarChart3, MapPin, Trees, Download, ClipboardList, Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  deleteAllHarvestBlocksAction,
  deleteAllHarvestFieldsAction,
  syncEstimationsFromCountAction,
} from '@/app/actions/harvest-import-actions'
import { exportHarvestToExcel } from '@/lib/agronomy/export-harvest-xlsx'
import { exportCountToExcel } from '@/lib/agronomy/export-count-xlsx'
import { countGroupKey, fmtCountAvg, listCountGroupSummaries } from '@/lib/agronomy/count-group-averages'
import { buildEstimationFromCountSummary } from '@/lib/agronomy/build-estimation-from-count'
import { type HarvestStatus } from '@/lib/agronomy/constants'
import {
  HARVEST_CROPS,
  getVarietiesForCrop,
  calculateHarvestEstimateKg,
  formatHarvestFormula,
  HARVEST_FORMULA_HINT,
  type HarvestCrop,
} from '@/lib/agronomy/harvest-yields'
import {
  HARVEST_COUNT_STATES,
  calculateCherryHarvest,
  computeCherryHarvestLive,
  getCherryCalculationSteps,
  getCherryVarietyDefaults,
  parseCherryFormNumbers,
  type HarvestCountState,
} from '@/lib/agronomy/cherry-harvest-formula'
import { currentSeasonLabel, formatKg } from '@/lib/agronomy/format'
import {
  HarvestCountCharts,
  HarvestEstimationCharts,
} from '@/components/dashboard/harvest/harvest-estimation-charts'
import { HarvestSeasonSummary } from '@/components/dashboard/harvest/harvest-season-summary'
import { HarvestPrePostTable } from '@/components/dashboard/harvest/harvest-pre-post-table'
import { HarvestEstimationCards } from '@/components/dashboard/harvest/harvest-estimation-cards'
import { HarvestRowBadge, isComputedHarvestRow } from '@/components/dashboard/harvest/harvest-row-badge'
import { OfflinePendingBadge } from '@/components/dashboard/offline-pending-badge'
import { computePrePostDeltaRows } from '@/lib/agronomy/compute-pre-post-delta'
import { loadHarvestModuleData, offlineWrite } from '@/lib/offline/agronomy-offline'
import { OFFLINE_EVENT } from '@/lib/offline/types'
import { useLocale } from '@/components/i18n/locale-provider'
import { useViewAsUserId } from '@/components/dashboard/view-as-provider'
import {
  HARVEST_INSPECTOR_CLIENT_STORAGE_KEY,
  InspectorHarvestClientSelect,
} from '@/components/dashboard/harvest/inspector-harvest-client-select'
import { fetchInspectorClientOptions, type InspectorClientOption } from '@/lib/tech-assistance/inspector-clients'

export type HarvestEstimationTab = 'conteo' | 'estimacion'

function isHarvestEstimationTab(value: string | null | undefined): value is HarvestEstimationTab {
  return value === 'conteo' || value === 'estimacion'
}

interface HarvestField {
  id: string
  name: string
}

interface HarvestBlock {
  id: string
  field_name: string
  block_name: string
  crop: string
  variety: string | null
  hectares: number | null
  plants_per_ha: number | null
}

interface HarvestEstimate {
  id: string
  field_name: string | null
  block_name: string
  crop: string
  variety: string | null
  season_label: string
  record_date: string | null
  hectares: number | null
  plants_per_ha: number | null
  dardos_per_plant: number | null
  dardos_per_branch: number | null
  dardo_coral: number | null
  hilera: number | null
  arbol: number | null
  is_count_summary: boolean
  count_sample_count: number | null
  primordia_per_dardo: number | null
  primordia_per_branch: number | null
  fruit_set_pct: number | null
  fruits_set: number | null
  fruit_weight_kg: number | null
  kg_per_plant: number | null
  kg_per_ha: number | null
  count_state: HarvestCountState | null
  estimated_kg: number
  harvested_kg: number
  expected_start: string | null
  expected_end: string | null
  status: HarvestStatus
  notes: string | null
}

type FormState = {
  field_name: string
  block_name: string
  block_id: string
  crop: HarvestCrop
  variety: string
  season_label: string
  record_date: string
  count_state: HarvestCountState
  hectares: string
  plants_per_ha: string
  dardos_per_plant: string
  dardos_per_branch: string
  dardo_coral: string
  primordia_per_dardo: string
  primordia_per_branch: string
  fruit_set_pct: string
  fruit_weight_kg: string
  harvested_kg: string
  notes: string
  hilera: string
  arbol: string
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function fmtPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  const pct = Number(v) <= 1 ? Number(v) * 100 : Number(v)
  return `${pct.toFixed(0)}%`
}

function applyCherryVarietyDefaults(variety: string) {
  const d = getCherryVarietyDefaults(variety)
  return {
    plants_per_ha: String(d.plantsPerHa),
    primordia_per_dardo: String(d.primordiaPerDardo),
    primordia_per_branch: String(d.primordiaPerBranch),
    fruit_set_pct: String(d.fruitSetPct),
    fruit_weight_kg: String(d.fruitWeightKg),
  }
}

function buildEmptyForm(season = currentSeasonLabel()): FormState {
  const variety = getVarietiesForCrop('Cerezo')[0]?.name ?? 'Santina'
  return {
    field_name: '',
    block_name: '',
    block_id: '',
    crop: 'Cerezo',
    variety,
    season_label: season,
    record_date: todayIso(),
    count_state: 'Pre-poda',
    hectares: '',
    plants_per_ha: '',
    dardos_per_plant: '',
    dardos_per_branch: '',
    dardo_coral: '',
    primordia_per_dardo: '',
    primordia_per_branch: '',
    fruit_set_pct: '',
    fruit_weight_kg: '',
    harvested_kg: '0',
    notes: '',
    hilera: '',
    arbol: '',
  }
}

const COUNT_STYLE: Record<HarvestCountState, string> = {
  'Pre-poda': 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30',
  'Post-poda': 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
}

function tCountState(t: (k: string) => string, state: HarvestCountState) {
  return state === 'Post-poda' ? t('estimacionCosecha.countState.postPoda') : t('estimacionCosecha.countState.prePoda')
}

function numStr(v: number | null | undefined, fallback = '') {
  if (v == null || !Number.isFinite(Number(v))) return fallback
  return String(v)
}

function fmtCount(v: number | null | undefined) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return fmtNum(Number(v), 2)
}

function fmtNum(v: number, decimals = 2) {
  return v.toLocaleString('es-CL', { maximumFractionDigits: decimals, minimumFractionDigits: 0 })
}

function ExcelCalcPanel({ form, t }: { form: FormState; t: (k: string) => string }) {
  const params = computeCherryHarvestLive(form)
  if (!params) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        {t('estimacionCosecha.calc.fillParams')}
      </div>
    )
  }

  const steps = getCherryCalculationSteps(params)
  const pct = params.fruitSetPct <= 1 ? Math.round(params.fruitSetPct * 100) : params.fruitSetPct

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium">{t('estimacionCosecha.calc.autoTitle')}</p>
      <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
        Frutos = ({fmtNum(params.dardosPerPlant, 1)} × {fmtNum(params.primordiaPerDardo, 2)}
        {' + '}{fmtNum(params.dardosPerBranch, 1)} × {fmtNum(params.primordiaPerBranch, 2)}) × {pct}%
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: t('estimacionCosecha.calc.fruitsSet'), value: fmtNum(steps.fruitsSet, 2) },
          { label: t('estimacionCosecha.calc.fruitWeight'), value: fmtNum(steps.fruitWeightKg, 3) },
          { label: t('estimacionCosecha.calc.kgPerPlant'), value: fmtNum(steps.kgPerPlant, 4) },
          { label: t('estimacionCosecha.calc.kgPerHa'), value: fmtNum(steps.kgPerHa, 1) },
          { label: t('estimacionCosecha.calc.totalKg'), value: fmtNum(steps.kgTotal, 0) },
        ].map((cell) => (
          <div key={cell.label} className="rounded-md border bg-background px-2 py-1.5">
            <p className="text-[10px] text-muted-foreground truncate">{cell.label}</p>
            <p className="text-sm font-semibold tabular-nums">{cell.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function formWithEstimationFallbacks(form: FormState, editing: HarvestEstimate | null): FormState {
  if (!editing) return form
  return {
    ...form,
    hectares: form.hectares.trim() || numStr(editing.hectares),
    plants_per_ha: form.plants_per_ha.trim() || numStr(editing.plants_per_ha),
    dardos_per_plant: form.dardos_per_plant.trim() || numStr(editing.dardos_per_plant),
    dardos_per_branch: form.dardos_per_branch.trim() || numStr(editing.dardos_per_branch),
    primordia_per_dardo: form.primordia_per_dardo.trim() || numStr(editing.primordia_per_dardo),
    primordia_per_branch: form.primordia_per_branch.trim() || numStr(editing.primordia_per_branch),
    fruit_set_pct: form.fruit_set_pct.trim() || numStr(editing.fruit_set_pct),
    fruit_weight_kg: form.fruit_weight_kg.trim() || numStr(editing.fruit_weight_kg),
  }
}

function computeFromForm(form: FormState, forSave = false) {
  if (form.crop === 'Cerezo') {
    const params = forSave ? parseCherryFormNumbers(form) : computeCherryHarvestLive(form)
    if (!params) return null
    const result = calculateCherryHarvest(params)
    return {
      ...result,
      estimatedKg: Math.round(result.kgTotal * 100) / 100,
    }
  }
  const ha = Number(form.hectares)
  const estimatedKg = calculateHarvestEstimateKg(form.crop, form.variety, ha)
  if (estimatedKg == null) return null
  return {
    fruitsSet: null,
    kgPerPlant: null,
    kgPerHa: estimatedKg / ha,
    kgTotal: estimatedKg,
    estimatedKg,
  }
}

export function HarvestEstimationManager({ initialTab = 'conteo' }: { initialTab?: HarvestEstimationTab } = {}) {
  const { t } = useLocale()
  const viewAsUserId = useViewAsUserId()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<HarvestEstimate[]>([])
  const [blocks, setBlocks] = useState<HarvestBlock[]>([])
  const [fields, setFields] = useState<HarvestField[]>([])
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [isInspector, setIsInspector] = useState(false)
  const [inspectorReady, setInspectorReady] = useState(false)
  const [inspectorClients, setInspectorClients] = useState<InspectorClientOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [blocksDialogOpen, setBlocksDialogOpen] = useState(false)
  const [fieldsDialogOpen, setFieldsDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<HarvestEstimationTab>(initialTab)

  useEffect(() => {
    if (isHarvestEstimationTab(initialTab)) setActiveTab(initialTab)
  }, [initialTab])

  function handleMainTabChange(tab: HarvestEstimationTab) {
    setActiveTab(tab)
    const href = tab === 'conteo'
      ? '/dashboard/estimacion-cosecha'
      : `/dashboard/estimacion-cosecha?tab=${tab}`
    router.replace(href, { scroll: false })
  }
  const [countView, setCountView] = useState<'promedios' | 'muestras'>('promedios')
  const [dialogMode, setDialogMode] = useState<'conteo' | 'estimacion'>('conteo')
  const [editing, setEditing] = useState<HarvestEstimate | null>(null)
  const [form, setForm] = useState<FormState>(() => buildEmptyForm())
  const [fieldFormName, setFieldFormName] = useState('')
  const [blockForm, setBlockForm] = useState({
    field_name: '',
    block_name: '',
    crop: 'Cerezo' as HarvestCrop,
    variety: '',
    hectares: '',
    plants_per_ha: '',
  })
  const [filterSeason, setFilterSeason] = useState(currentSeasonLabel())
  const [filterCrop, setFilterCrop] = useState<string>('all')
  const [filterField, setFilterField] = useState<string>('all')
  const [filterCountState, setFilterCountState] = useState<string>('all')
  const [filterVariety, setFilterVariety] = useState<string>('all')
  const [filterBlock, setFilterBlock] = useState<string>('all')

  const cropsInUse = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.crop) set.add(r.crop)
    for (const b of blocks) if (b.crop) set.add(b.crop)
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [rows, blocks])

  const isCherry = form.crop === 'Cerezo'
  const varietyOptions = useMemo(() => getVarietiesForCrop(form.crop), [form.crop])
  const computedLive = useMemo(() => computeFromForm(form, false), [form])
  const computedSave = useMemo(() => computeFromForm(form, true), [form])

  const canSaveDialog = useMemo(() => {
    if (saving) return false
    if (computedSave) return true
    if (dialogMode === 'estimacion' && editing) {
      return Number(form.hectares) > 0
    }
    return false
  }, [saving, computedSave, dialogMode, editing, form.hectares])

  const fieldOptions = useMemo(() => {
    const fromCatalog = fields.map((f) => f.name)
    const fromData = [
      ...rows.map((r) => r.field_name),
      ...blocks.map((b) => b.field_name),
    ].filter(Boolean) as string[]
    return [...new Set([...fromCatalog, ...fromData])].sort()
  }, [fields, rows, blocks])

  const orphanFieldNames = useMemo(() => {
    const catalog = new Set(fields.map((f) => f.name))
    return fieldOptions.filter((name) => !catalog.has(name))
  }, [fields, fieldOptions])

  const hasFieldOptions = fieldOptions.length > 0

  const blocksForSelectedField = useMemo(
    () => blocks.filter((b) => !form.field_name || b.field_name === form.field_name),
    [blocks, form.field_name],
  )

  const inspectorClientId = isInspector ? selectedClientId || null : null
  const inspectorCanWork = !isInspector || Boolean(ownerId)
  /** Clientes y subusuarios solo visualizan; inspectores registran conteos. */
  const canEditHarvest = isInspector

  function requireInspectorClient(): boolean {
    if (!isInspector || ownerId) return true
    toast.error(t('estimacionCosecha.inspector.selectClientFirst'))
    return false
  }

  useEffect(() => {
    let cancelled = false
    setInspectorReady(false)
    void (async () => {
      const { userId: actingUserId } = await getEffectiveUserId(supabase, viewAsUserId)
      if (!actingUserId || cancelled) {
        if (!cancelled) {
          setIsInspector(false)
          setInspectorClients([])
          setSelectedClientId('')
          setInspectorReady(true)
        }
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_tech_inspector')
        .eq('id', actingUserId)
        .maybeSingle()

      if (!profile?.is_tech_inspector) {
        if (!cancelled) {
          setIsInspector(false)
          setInspectorClients([])
          setSelectedClientId('')
          setInspectorReady(true)
        }
        return
      }

      const clients = await fetchInspectorClientOptions(supabase, actingUserId)
      if (cancelled) return

      setIsInspector(true)
      setInspectorClients(clients)
      const stored =
        typeof window !== 'undefined'
          ? window.sessionStorage.getItem(HARVEST_INSPECTOR_CLIENT_STORAGE_KEY)
          : null
      const initial =
        stored && clients.some(c => c.id === stored) ? stored : clients[0]?.id ?? ''
      setSelectedClientId(initial)
      setInspectorReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, viewAsUserId])

  const handleInspectorClientChange = useCallback((clientId: string) => {
    setSelectedClientId(clientId)
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(HARVEST_INSPECTOR_CLIENT_STORAGE_KEY, clientId)
    }
  }, [])

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!inspectorReady) return
    if (isInspector && !selectedClientId) {
      setOwnerId(null)
      setRows([])
      setBlocks([])
      setFields([])
      if (!options?.silent) setLoading(false)
      return
    }

    if (!options?.silent) setLoading(true)

    let dataOwnerId: string | null = null
    if (isInspector) {
      dataOwnerId = selectedClientId
    } else {
      const { effectiveUserId } = await getEffectiveUserId(supabase)
      dataOwnerId = effectiveUserId
    }

    if (!dataOwnerId) {
      if (!options?.silent) setLoading(false)
      return
    }
    setOwnerId(dataOwnerId)

    try {
      const data = await loadHarvestModuleData(supabase, dataOwnerId)
      const loadedRows = data.estimates as unknown as HarvestEstimate[]
      const loadedBlocks = data.blocks as unknown as HarvestBlock[]
      const loadedFields = data.fields as unknown as HarvestField[]

      setRows(loadedRows)
      setBlocks(loadedBlocks)

      if (data.fromCache) {
        if (loadedRows.length === 0 && loadedBlocks.length === 0) {
          toast.info(t('estimacionCosecha.toasts.offlinePreload'))
        }
        setFields(loadedFields)
        return
      }

      const catalogNames = new Set(loadedFields.map((f) => f.name))
      const orphanNames = [
        ...new Set([
          ...loadedRows.map((r) => r.field_name?.trim()).filter(Boolean) as string[],
          ...loadedBlocks.map((b) => b.field_name?.trim()).filter(Boolean) as string[],
        ].filter((name) => !catalogNames.has(name))),
      ]

      if (orphanNames.length > 0) {
        const { error: syncError } = await supabase.from('harvest_fields').upsert(
          orphanNames.map((name) => ({ user_id: dataOwnerId, name })),
          { onConflict: 'user_id,name', ignoreDuplicates: true },
        )
        if (syncError) {
          console.error(syncError)
          setFields(loadedFields)
        } else {
          const { data: syncedFields } = await supabase
            .from('harvest_fields')
            .select('id, name')
            .eq('user_id', dataOwnerId)
            .order('name')
          setFields((syncedFields ?? loadedFields) as HarvestField[])
        }
      } else {
        setFields(loadedFields)
      }
    } catch (err) {
      console.error(err)
      toast.error(t('estimacionCosecha.toasts.loadFailed'))
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }, [supabase, t, inspectorReady, isInspector, selectedClientId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const onSyncDone = (event: Event) => {
      const detail = (event as CustomEvent<{ synced?: number; failed?: number }>).detail
      if ((detail?.synced ?? 0) > 0) void load({ silent: true })
    }
    window.addEventListener(OFFLINE_EVENT.syncDone, onSyncDone)
    return () => {
      window.removeEventListener(OFFLINE_EVENT.syncDone, onSyncDone)
    }
  }, [load])

  const seasonFiltered = useMemo(() => rows.filter((r) => {
    if (filterSeason && r.season_label !== filterSeason) return false
    if (filterCrop !== 'all' && r.crop !== filterCrop) return false
    if (filterField !== 'all' && (r.field_name ?? '') !== filterField) return false
    if (filterCountState !== 'all' && (r.count_state ?? 'Pre-poda') !== filterCountState) return false
    return true
  }), [rows, filterSeason, filterCrop, filterField, filterCountState])

  const varietiesInUse = useMemo(() => {
    const set = new Set<string>()
    for (const r of seasonFiltered) {
      const v = r.variety?.trim() || r.crop
      if (v) set.add(v)
    }
    for (const b of blocks) {
      if (filterField !== 'all' && b.field_name !== filterField) continue
      if (b.variety?.trim()) set.add(b.variety.trim())
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [seasonFiltered, blocks, filterField])

  const blocksInUse = useMemo(() => {
    const set = new Set<string>()
    for (const r of seasonFiltered) {
      if (r.block_name?.trim()) set.add(r.block_name.trim())
    }
    for (const b of blocks) {
      if (filterField !== 'all' && b.field_name !== filterField) continue
      set.add(b.block_name)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [seasonFiltered, blocks, filterField])

  const filtered = useMemo(() => seasonFiltered.filter((r) => {
    const variety = r.variety?.trim() || r.crop
    if (filterVariety !== 'all' && variety !== filterVariety) return false
    if (filterBlock !== 'all' && r.block_name !== filterBlock) return false
    return true
  }), [seasonFiltered, filterVariety, filterBlock])

  useEffect(() => {
    setFilterVariety('all')
    setFilterBlock('all')
  }, [filterSeason, filterField, filterCountState, filterCrop])

  useEffect(() => {
    if (filterVariety !== 'all' && !varietiesInUse.includes(filterVariety)) {
      setFilterVariety('all')
    }
  }, [filterVariety, varietiesInUse])

  useEffect(() => {
    if (filterBlock !== 'all' && !blocksInUse.includes(filterBlock)) {
      setFilterBlock('all')
    }
  }, [filterBlock, blocksInUse])

  const countRows = useMemo(
    () => filtered.filter((r) => r.hilera != null || r.arbol != null || r.is_count_summary === false),
    [filtered],
  )

  const estimationRows = useMemo(
    () => filtered.filter((r) =>
      r.is_count_summary === true
      || (r.is_count_summary == null && r.hilera == null && r.arbol == null),
    ),
    [filtered],
  )

  const countSummaries = useMemo(() => {
    const fromSamples = listCountGroupSummaries(countRows)
    const keysWithSamples = new Set(fromSamples.map((s) => countGroupKey(s)))

    const fromManual = estimationRows
      .filter((r) => !keysWithSamples.has(countGroupKey(r)))
      .map((r) => ({
        field_name: r.field_name ?? '',
        block_name: r.block_name,
        variety: r.variety ?? r.crop,
        count_state: (r.count_state ?? 'Pre-poda') as string,
        hilera: r.hilera,
        arbol: r.arbol,
        dardos_per_plant: r.dardos_per_plant,
        dardos_per_branch: r.dardos_per_branch,
        dardo_coral: r.dardo_coral,
        sample_count: r.count_sample_count ?? 1,
      }))

    return [...fromSamples, ...fromManual].sort((a, b) =>
      a.field_name.localeCompare(b.field_name, 'es')
      || a.block_name.localeCompare(b.block_name, 'es')
      || a.variety.localeCompare(b.variety, 'es'),
    )
  }, [countRows, estimationRows])

  const seasons = useMemo(
    () => [...new Set(rows.map((r) => r.season_label).filter(Boolean))].sort().reverse(),
    [rows],
  )

  const estimationDisplayRows = useMemo((): HarvestEstimate[] => {
    const season = filterSeason || seasons[0] || currentSeasonLabel()

    if (countSummaries.length === 0) return estimationRows

    return countSummaries.map((summary) => {
      const block = blocks.find(
        (b) => b.field_name === summary.field_name && b.block_name === summary.block_name,
      )
      const existing = estimationRows.find(
        (r) => countGroupKey(r) === countGroupKey(summary) && r.season_label === season,
      )
      const hectares = (existing?.hectares != null && existing.hectares > 0)
        ? existing.hectares
        : (block?.hectares != null && block.hectares > 0 ? block.hectares : 0)
      const blockForCalc = block ?? (existing ? {
        id: '',
        field_name: summary.field_name,
        block_name: summary.block_name,
        crop: existing.crop,
        variety: existing.variety,
        hectares: existing.hectares,
        plants_per_ha: existing.plants_per_ha,
      } : null)
      const built = buildEstimationFromCountSummary(summary, {
        season_label: season,
        block: blockForCalc
          ? { ...blockForCalc, hectares, plants_per_ha: blockForCalc.plants_per_ha ?? existing?.plants_per_ha ?? null }
          : (hectares > 0 ? {
            field_name: summary.field_name,
            block_name: summary.block_name,
            crop: existing?.crop ?? 'Cerezo',
            variety: summary.variety,
            hectares,
            plants_per_ha: existing?.plants_per_ha ?? null,
          } : null),
        crop: block?.crop ?? existing?.crop,
      })

      return {
        id: existing?.id ?? `computed-${countGroupKey(summary)}::${season}`,
        field_name: built.field_name,
        block_name: built.block_name,
        crop: built.crop,
        variety: built.variety || null,
        season_label: season,
        record_date: existing?.record_date ?? null,
        hectares: hectares > 0 ? hectares : null,
        plants_per_ha: built.plants_per_ha,
        dardos_per_plant: built.dardos_per_plant,
        dardos_per_branch: built.dardos_per_branch,
        dardo_coral: built.dardo_coral,
        hilera: null,
        arbol: null,
        is_count_summary: true,
        count_sample_count: built.count_sample_count ?? null,
        primordia_per_dardo: built.primordia_per_dardo,
        primordia_per_branch: built.primordia_per_branch,
        fruit_set_pct: built.fruit_set_pct,
        fruits_set: built.fruits_set,
        fruit_weight_kg: built.fruit_weight_kg,
        kg_per_plant: built.kg_per_plant,
        kg_per_ha: built.kg_per_ha,
        count_state: built.count_state,
        estimated_kg: built.estimated_kg,
        harvested_kg: existing?.harvested_kg ?? 0,
        expected_start: existing?.expected_start ?? null,
        expected_end: existing?.expected_end ?? null,
        status: existing?.status ?? 'planificado',
        notes: existing?.notes ?? null,
      }
    })
  }, [countSummaries, blocks, estimationRows, filterSeason, seasons])

  const totals = useMemo(
    () => estimationDisplayRows.reduce((s, r) => s + Number(r.estimated_kg), 0),
    [estimationDisplayRows],
  )

  const totalsByField = useMemo(() => {
    const noField = t('estimacionCosecha.misc.noField')
    const map = new Map<string, number>()
    for (const r of estimationDisplayRows) {
      const key = r.field_name || noField
      map.set(key, (map.get(key) ?? 0) + Number(r.estimated_kg))
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [estimationDisplayRows, t])

  const chartByField = useMemo(
    () => totalsByField.map(([name, kg]) => ({ name, kg })),
    [totalsByField],
  )

  const chartByBlock = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of estimationDisplayRows) {
      const label = r.field_name ? `${r.field_name} · ${r.block_name}` : r.block_name
      map.set(label, (map.get(label) ?? 0) + Number(r.estimated_kg))
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, kg]) => ({ name, kg }))
  }, [estimationDisplayRows])

  const chartByVariety = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of estimationDisplayRows) {
      const key = r.variety?.trim() || r.crop
      map.set(key, (map.get(key) ?? 0) + Number(r.estimated_kg))
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, kg]) => ({ name, kg }))
  }, [estimationDisplayRows])

  const chartPrePostComparison = useMemo(() => {
    const map = new Map<string, { name: string; pre: number; post: number }>()
    for (const r of estimationDisplayRows) {
      const key = `${r.field_name ?? ''}::${r.block_name}::${r.variety ?? r.crop}`
      const label = `${r.block_name} · ${r.variety ?? r.crop}`
      const entry = map.get(key) ?? { name: label, pre: 0, post: 0 }
      if (r.count_state === 'Post-poda') entry.post += Number(r.estimated_kg)
      else entry.pre += Number(r.estimated_kg)
      map.set(key, entry)
    }
    return [...map.values()].filter((e) => e.pre > 0 || e.post > 0)
  }, [estimationDisplayRows])

  const chartTimeline = useMemo(() => {
    const noDate = t('estimacionCosecha.misc.noDate')
    const map = new Map<string, number>()
    for (const r of estimationDisplayRows) {
      const date = r.record_date ?? noDate
      map.set(date, (map.get(date) ?? 0) + Number(r.estimated_kg))
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, estimated]) => ({ date, estimated }))
  }, [estimationDisplayRows, t])

  const countAvgDardosByBlock = useMemo(() => {
    const map = new Map<string, { name: string; sum: number; n: number }>()
    for (const row of countSummaries) {
      const key = `${row.field_name}::${row.block_name}::${row.variety}`
      const label = `${row.block_name} · ${row.variety}`
      const entry = map.get(key) ?? { name: label, sum: 0, n: 0 }
      entry.sum += Number(row.dardos_per_plant ?? 0)
      entry.n += 1
      map.set(key, entry)
    }
    return [...map.values()]
      .map((e) => ({ name: e.name, value: e.n > 0 ? e.sum / e.n : 0 }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [countSummaries])

  const countAvgTwigsByBlock = useMemo(() => {
    const map = new Map<string, { name: string; sum: number; n: number }>()
    for (const row of countSummaries) {
      const key = `${row.field_name}::${row.block_name}::${row.variety}`
      const label = `${row.block_name} · ${row.variety}`
      const entry = map.get(key) ?? { name: label, sum: 0, n: 0 }
      entry.sum += Number(row.dardos_per_branch ?? 0)
      entry.n += 1
      map.set(key, entry)
    }
    return [...map.values()]
      .map((e) => ({ name: e.name, value: e.n > 0 ? e.sum / e.n : 0 }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [countSummaries])

  const countPrePostDardos = useMemo(() => {
    const map = new Map<string, { name: string; pre: number; post: number }>()
    for (const row of countSummaries) {
      const dardos = Number(row.dardos_per_plant ?? 0)
      if (!Number.isFinite(dardos) || dardos <= 0) continue

      const key = `${row.field_name}::${row.block_name}::${row.variety}`
      const label = `${row.block_name} · ${row.variety}`
      const entry = map.get(key) ?? { name: label, pre: 0, post: 0 }

      if ((row.count_state ?? 'Pre-poda') === 'Post-poda') {
        entry.post = dardos
      } else {
        entry.pre = dardos
      }
      map.set(key, entry)
    }
    return [...map.values()]
      .filter((e) => e.pre > 0 || e.post > 0)
      .sort((a, b) => Math.max(b.pre, b.post) - Math.max(a.pre, a.post))
  }, [countSummaries])

  const missingHaCount = useMemo(
    () => estimationDisplayRows.filter((r) => !r.hectares || r.hectares <= 0).length,
    [estimationDisplayRows],
  )

  const computedCount = useMemo(
    () => estimationDisplayRows.filter((r) => isComputedHarvestRow(r.id)).length,
    [estimationDisplayRows],
  )

  const savedCount = useMemo(
    () => estimationDisplayRows.filter((r) => !isComputedHarvestRow(r.id)).length,
    [estimationDisplayRows],
  )

  const lastRecordDate = useMemo(() => {
    const dates = estimationDisplayRows
      .map((r) => r.record_date)
      .filter(Boolean) as string[]
    return dates.sort().reverse()[0] ?? null
  }, [estimationDisplayRows])

  const prePostDeltaRows = useMemo(
    () => computePrePostDeltaRows(
      rows,
      blocks,
      filterSeason || seasons[0] || currentSeasonLabel(),
      {
        field: filterField,
        crop: filterCrop,
        variety: filterVariety,
        block: filterBlock,
      },
    ),
    [rows, blocks, filterSeason, seasons, filterField, filterCrop, filterVariety, filterBlock],
  )

  function applyBlockToForm(block: HarvestBlock) {
    setForm((prev) => ({
      ...prev,
      block_id: block.id,
      field_name: block.field_name,
      block_name: block.block_name,
      crop: HARVEST_CROPS.includes(block.crop as HarvestCrop) ? (block.crop as HarvestCrop) : prev.crop,
      variety: block.variety ?? prev.variety,
      hectares: block.hectares != null ? String(block.hectares) : prev.hectares,
      plants_per_ha: block.plants_per_ha != null
        ? String(block.plants_per_ha)
        : prev.plants_per_ha,
    }))
  }

  function openCreateCount() {
    if (!requireInspectorClient()) return
    setDialogMode('conteo')
    setEditing(null)
    setForm(buildEmptyForm(filterSeason || currentSeasonLabel()))
    setDialogOpen(true)
  }

  function openCreateEstimation() {
    if (!requireInspectorClient()) return
    setDialogMode('estimacion')
    setEditing(null)
    const season = filterSeason || currentSeasonLabel()
    const base = buildEmptyForm(season)
    setForm({
      ...base,
      ...(base.crop === 'Cerezo' ? applyCherryVarietyDefaults(base.variety) : {}),
    })
    setDialogOpen(true)
  }

  function openEditCount(row: HarvestEstimate) {
    setDialogMode('conteo')
    openEdit(row)
  }

  function openEditEstimation(row: HarvestEstimate) {
    setDialogMode('estimacion')
    openEdit(row)
  }

  function openEdit(row: HarvestEstimate) {
    setEditing(row)
    const crop = HARVEST_CROPS.includes(row.crop as HarvestCrop)
      ? (row.crop as HarvestCrop)
      : 'Cerezo'
    const variety = row.variety ?? getVarietiesForCrop(crop)[0]?.name ?? ''

    setForm({
      field_name: row.field_name ?? '',
      block_name: row.block_name,
      block_id: '',
      crop,
      variety,
      season_label: row.season_label,
      record_date: row.record_date ?? todayIso(),
      count_state: (row.count_state as HarvestCountState) ?? 'Pre-poda',
      hectares: numStr(row.hectares),
      plants_per_ha: numStr(row.plants_per_ha),
      dardos_per_plant: numStr(row.dardos_per_plant),
      dardos_per_branch: numStr(row.dardos_per_branch),
      dardo_coral: numStr(row.dardo_coral),
      primordia_per_dardo: numStr(row.primordia_per_dardo),
      primordia_per_branch: numStr(row.primordia_per_branch),
      fruit_set_pct: numStr(row.fruit_set_pct),
      fruit_weight_kg: numStr(row.fruit_weight_kg),
      harvested_kg: String(row.harvested_kg),
      notes: row.notes ?? '',
      hilera: row.hilera != null ? String(row.hilera) : '',
      arbol: row.arbol != null ? String(row.arbol) : '',
    })
    setDialogOpen(true)
  }

  function handleCropChange(crop: HarvestCrop) {
    const variety = getVarietiesForCrop(crop)[0]?.name ?? ''
    setForm((prev) => ({
      ...prev,
      crop,
      variety,
      dardos_per_plant: '',
      dardos_per_branch: '',
      dardo_coral: '',
      ...(crop === 'Cerezo' ? {
        plants_per_ha: '',
        primordia_per_dardo: '',
        primordia_per_branch: '',
        fruit_set_pct: '',
        fruit_weight_kg: '',
      } : {
        plants_per_ha: '',
        primordia_per_dardo: '',
        primordia_per_branch: '',
        fruit_set_pct: '',
        fruit_weight_kg: '',
      }),
    }))
  }

  function handleVarietyChange(variety: string) {
    setForm((prev) => ({
      ...prev,
      variety,
      ...(prev.crop === 'Cerezo' ? applyCherryVarietyDefaults(variety) : {}),
    }))
  }

  async function handleDeleteAllFields() {
    if (!confirm(t('estimacionCosecha.confirms.deleteAllFields', { count: fieldOptions.length }))) return
    setSaving(true)
    const result = await deleteAllHarvestFieldsAction(inspectorClientId)
    setSaving(false)
    if (!result.ok) toast.error(result.error)
    else { toast.success(t('estimacionCosecha.toasts.fieldsDeleted')); load() }
  }

  async function handleDeleteAllBlocks() {
    if (!confirm(t('estimacionCosecha.confirms.deleteAllBlocks', { count: blocks.length }))) return
    setSaving(true)
    const result = await deleteAllHarvestBlocksAction(inspectorClientId)
    setSaving(false)
    if (!result.ok) toast.error(result.error)
    else { toast.success(t('estimacionCosecha.toasts.blocksDeleted')); load() }
  }

  async function handleExportCount() {
    if (countRows.length === 0) {
      toast.error(t('estimacionCosecha.toasts.noCountExport'))
      return
    }
    try {
      await exportCountToExcel(countRows, filterSeason || undefined)
      toast.success(t('estimacionCosecha.toasts.countExcelDownloaded'), {
        description: t('estimacionCosecha.toasts.samplesExported', { count: countRows.length }),
      })
    } catch {
      toast.error(t('estimacionCosecha.toasts.countExportError'))
    }
  }

  async function handleExportEstimation() {
    if (estimationDisplayRows.length === 0) {
      toast.error(t('estimacionCosecha.toasts.noEstimationExport'))
      return
    }
    try {
      await exportHarvestToExcel(estimationDisplayRows, filterSeason || undefined)
      toast.success(t('estimacionCosecha.toasts.estimationExcelDownloaded'), {
        description: t('estimacionCosecha.toasts.estimationsExported', { count: estimationDisplayRows.length }),
      })
    } catch {
      toast.error(t('estimacionCosecha.toasts.estimationExportError'))
    }
  }

  async function handleSyncEstimations() {
    setSaving(true)
    const result = await syncEstimationsFromCountAction(filterSeason || undefined, inspectorClientId)
    setSaving(false)
    if (!result.ok) {
      toast.error(t('estimacionCosecha.toasts.calcFailed'), { description: result.error })
      return
    }
    toast.success(t('estimacionCosecha.toasts.estimationsUpdated'), {
      description: t('estimacionCosecha.toasts.blocksCalculated', { count: result.updated }),
    })
    load()
  }

  async function handleSaveField() {
    if (!ownerId) return
    if (!fieldFormName.trim()) {
      toast.error(t('estimacionCosecha.toasts.fieldNameRequired'))
      return
    }
    setSaving(true)
    const name = fieldFormName.trim()
    const result = await offlineWrite(supabase, {
      userId: ownerId,
      table: 'harvest_fields',
      operation: 'upsert',
      payload: { user_id: ownerId, name },
      onConflict: 'user_id,name',
      cacheModule: 'harvest',
      cacheListKey: 'fields',
      optimisticRecord: { id: `local-field-${name}`, name, user_id: ownerId },
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(t('estimacionCosecha.toasts.fieldCreateFailed'), { description: result.error })
      return
    }
    toast.success(result.offline ? t('estimacionCosecha.toasts.fieldSavedLocal') : t('estimacionCosecha.toasts.fieldAdded'))
    setFieldFormName('')
    load()
  }

  async function handleDeleteField(id: string, name: string) {
    if (!ownerId) return
    if (!confirm(t('estimacionCosecha.confirms.deleteField', { name }))) return
    const result = await offlineWrite(supabase, {
      userId: ownerId,
      table: 'harvest_fields',
      operation: 'delete',
      payload: {},
      match: { id },
      cacheModule: 'harvest',
      cacheListKey: 'fields',
    })
    if (!result.ok) toast.error(t('estimacionCosecha.toasts.deleteFailed'))
    else {
      toast.success(result.offline ? t('estimacionCosecha.toasts.deleteQueued') : t('estimacionCosecha.toasts.fieldDeleted'))
      load()
    }
  }

  async function handleSaveBlock() {
    if (!ownerId) return
    if (!blockForm.field_name.trim() || !blockForm.block_name.trim()) {
      toast.error(t('estimacionCosecha.toasts.fieldBlockRequired'))
      return
    }
    setSaving(true)
    const payload = {
      user_id: ownerId,
      field_name: blockForm.field_name.trim(),
      block_name: blockForm.block_name.trim(),
      crop: blockForm.crop,
      variety: blockForm.variety.trim() || null,
      hectares: blockForm.hectares ? Number(blockForm.hectares) : null,
      plants_per_ha: blockForm.plants_per_ha ? Number(blockForm.plants_per_ha) : null,
    }
    const result = await offlineWrite(supabase, {
      userId: ownerId,
      table: 'harvest_blocks',
      operation: 'insert',
      payload,
      cacheModule: 'harvest',
      cacheListKey: 'blocks',
      optimisticRecord: payload,
    })
    setSaving(false)
    if (!result.ok) {
      toast.error(t('estimacionCosecha.toasts.blockCreateFailed'), { description: result.error })
      return
    }
    toast.success(result.offline ? t('estimacionCosecha.toasts.blockSavedLocal') : t('estimacionCosecha.toasts.blockAdded'))
    setBlockForm({
      field_name: blockForm.field_name,
      block_name: '',
      crop: blockForm.crop,
      variety: blockForm.variety,
      hectares: '',
      plants_per_ha: blockForm.plants_per_ha,
    })
    load()
  }

  async function handleDeleteBlock(id: string, name: string) {
    if (!ownerId) return
    if (!confirm(t('estimacionCosecha.confirms.deleteBlock', { name }))) return
    const result = await offlineWrite(supabase, {
      userId: ownerId,
      table: 'harvest_blocks',
      operation: 'delete',
      payload: {},
      match: { id },
      cacheModule: 'harvest',
      cacheListKey: 'blocks',
    })
    if (!result.ok) toast.error(t('estimacionCosecha.toasts.deleteFailed'))
    else {
      toast.success(result.offline ? t('estimacionCosecha.toasts.deleteQueued') : t('estimacionCosecha.toasts.blockDeleted'))
      load()
    }
  }

  async function handleSave() {
    if (!canEditHarvest) return
    if (!ownerId) return

    const isEstimation = dialogMode === 'estimacion'
    const isComputedEdit = editing?.id?.startsWith('computed-')

    if (!form.block_name.trim() || !form.crop.trim()) {
      toast.error(t('estimacionCosecha.toasts.blockRequired'))
      return
    }
    if (!form.field_name.trim()) {
      toast.error(t('estimacionCosecha.toasts.fieldRequired'))
      return
    }
    if (!form.variety.trim()) {
      toast.error(t('estimacionCosecha.toasts.varietyRequired'))
      return
    }
    if (!form.record_date) {
      toast.error(t('estimacionCosecha.toasts.dateRequired'))
      return
    }

    const saveForm = isEstimation && editing
      ? formWithEstimationFallbacks(form, editing)
      : form

    const computed = computeFromForm(saveForm, true)
    if (!computed) {
      toast.error(isEstimation
        ? t('estimacionCosecha.toasts.fillEstimation')
        : t('estimacionCosecha.toasts.fillCount'))
      return
    }

    setSaving(true)

    if (isEstimation && Number(saveForm.hectares) > 0) {
      await offlineWrite(supabase, {
        userId: ownerId,
        table: 'harvest_blocks',
        operation: 'upsert',
        payload: {
          user_id: ownerId,
          field_name: saveForm.field_name.trim(),
          block_name: saveForm.block_name.trim(),
          crop: saveForm.crop.trim(),
          variety: saveForm.variety.trim() || null,
          hectares: Number(saveForm.hectares),
          plants_per_ha: Number(saveForm.plants_per_ha) || null,
        },
        onConflict: 'user_id,field_name,block_name',
        cacheModule: 'harvest',
        cacheListKey: 'blocks',
      })
    }

    const payload: Record<string, unknown> = {
      user_id: ownerId,
      field_name: saveForm.field_name.trim() || null,
      block_name: saveForm.block_name.trim(),
      crop: saveForm.crop.trim(),
      variety: saveForm.variety.trim(),
      season_label: saveForm.season_label.trim() || currentSeasonLabel(),
      record_date: saveForm.record_date,
      hectares: Number(saveForm.hectares),
      estimated_kg: computed.estimatedKg,
      harvested_kg: Number(saveForm.harvested_kg) || 0,
      ...(dialogMode === 'conteo' ? { notes: saveForm.notes.trim() || null } : {}),
      count_state: isCherry ? saveForm.count_state : null,
      is_count_summary: isEstimation,
      hilera: isEstimation ? null : (saveForm.hilera.trim() ? Number(saveForm.hilera) : null),
      arbol: isEstimation ? null : (saveForm.arbol.trim() ? Number(saveForm.arbol) : null),
      count_sample_count: isEstimation
        ? (editing?.count_sample_count ?? 1)
        : (editing?.count_sample_count ?? 1),
      updated_at: new Date().toISOString(),
    }

    if (isCherry && computed.fruitsSet != null) {
      Object.assign(payload, {
        plants_per_ha: Number(saveForm.plants_per_ha),
        dardos_per_plant: Number(saveForm.dardos_per_plant) || 0,
        dardos_per_branch: Number(saveForm.dardos_per_branch) || 0,
        dardo_coral: saveForm.dardo_coral.trim() ? Number(saveForm.dardo_coral) : null,
        primordia_per_dardo: Number(saveForm.primordia_per_dardo),
        primordia_per_branch: Number(saveForm.primordia_per_branch),
        fruit_set_pct: Number(saveForm.fruit_set_pct) > 1
          ? Number(saveForm.fruit_set_pct) / 100
          : Number(saveForm.fruit_set_pct),
        fruits_set: computed.fruitsSet,
        fruit_weight_kg: Number(saveForm.fruit_weight_kg),
        kg_per_plant: computed.kgPerPlant,
        kg_per_ha: computed.kgPerHa,
      })
    } else {
      Object.assign(payload, {
        kg_per_ha: computed.kgPerHa,
      })
    }

    let targetId = editing?.id
    if (isComputedEdit && editing) {
      const match = estimationRows.find(
        (r) => countGroupKey(r) === countGroupKey({
          field_name: saveForm.field_name,
          block_name: saveForm.block_name,
          variety: saveForm.variety,
          count_state: saveForm.count_state,
        }) && r.season_label === (saveForm.season_label.trim() || currentSeasonLabel()),
      )
      if (match && !match.id.startsWith('computed-')) targetId = match.id
    }

    const isUpdate = !!(targetId && !targetId.startsWith('computed-'))
    const writeResult = await offlineWrite(supabase, {
      userId: ownerId,
      table: 'harvest_estimates',
      operation: isUpdate ? 'update' : 'insert',
      payload,
      match: isUpdate ? { id: targetId! } : undefined,
      cacheModule: 'harvest',
      cacheListKey: 'estimates',
      optimisticRecord: { ...payload, id: targetId ?? undefined },
    })

    setSaving(false)
    if (!writeResult.ok) {
      toast.error(t('estimacionCosecha.toasts.saveFailed'), { description: writeResult.error })
      return
    }
    toast.success(
      writeResult.offline
        ? t('estimacionCosecha.toasts.savedLocal')
        : isEstimation
          ? (isUpdate ? t('estimacionCosecha.toasts.estimationUpdated') : t('estimacionCosecha.toasts.estimationRegistered'))
          : (editing ? t('estimacionCosecha.toasts.countUpdated') : t('estimacionCosecha.toasts.countRegistered')),
    )
    setDialogOpen(false)
    load()
  }

  async function handleDelete(row: HarvestEstimate) {
    if (!canEditHarvest) return
    if (row.id.startsWith('computed-')) {
      toast.error(t('estimacionCosecha.toasts.computeFirst'), {
        description: t('estimacionCosecha.toasts.computeFirstDesc'),
      })
      return
    }
    if (!confirm(t('estimacionCosecha.confirms.deleteEstimation', { block: row.block_name }))) return
    if (!ownerId) return
    const result = await offlineWrite(supabase, {
      userId: ownerId,
      table: 'harvest_estimates',
      operation: 'delete',
      payload: {},
      match: { id: row.id },
      cacheModule: 'harvest',
      cacheListKey: 'estimates',
    })
    if (!result.ok) toast.error(t('estimacionCosecha.toasts.deleteFailed'))
    else {
      toast.success(result.offline ? t('estimacionCosecha.toasts.deleteQueued') : t('estimacionCosecha.toasts.deleted'))
      load()
    }
  }

  if (!inspectorReady || loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        {t('estimacionCosecha.loading')}
      </div>
    )
  }

  const renderFilterPanel = (actions?: React.ReactNode) => (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="space-y-1.5 min-w-0">
          <label className="text-xs font-medium text-muted-foreground">{t('estimacionCosecha.filters.season')}</label>
          <Select value={filterSeason} onValueChange={setFilterSeason}>
            <SelectTrigger className="w-full h-9"><SelectValue placeholder={t('estimacionCosecha.filters.season')} /></SelectTrigger>
            <SelectContent>
              {seasons.length === 0 && (
                <SelectItem value={currentSeasonLabel()}>{currentSeasonLabel()}</SelectItem>
              )}
              {seasons.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 min-w-0">
          <label className="text-xs font-medium text-muted-foreground">{t('estimacionCosecha.filters.crop')}</label>
          <Select value={filterCrop} onValueChange={setFilterCrop}>
            <SelectTrigger className="w-full h-9"><SelectValue placeholder={t('estimacionCosecha.filters.crop')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('estimacionCosecha.filters.allCrops')}</SelectItem>
              {cropsInUse.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 min-w-0">
          <label className="text-xs font-medium text-muted-foreground">{t('estimacionCosecha.filters.field')}</label>
          <Select value={filterField} onValueChange={setFilterField}>
            <SelectTrigger className="w-full h-9"><SelectValue placeholder={t('estimacionCosecha.filters.field')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('estimacionCosecha.filters.allFields')}</SelectItem>
              {fieldOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 min-w-0">
          <label className="text-xs font-medium text-muted-foreground">{t('estimacionCosecha.filters.count')}</label>
          <Select value={filterCountState} onValueChange={setFilterCountState}>
            <SelectTrigger className="w-full h-9"><SelectValue placeholder={t('estimacionCosecha.filters.count')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('estimacionCosecha.filters.preAndPost')}</SelectItem>
              {HARVEST_COUNT_STATES.map((s) => <SelectItem key={s} value={s}>{tCountState(t, s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 min-w-0">
          <label className="text-xs font-medium text-muted-foreground">{t('estimacionCosecha.filters.variety')}</label>
          <Select value={filterVariety} onValueChange={setFilterVariety}>
            <SelectTrigger className="w-full h-9"><SelectValue placeholder={t('estimacionCosecha.filters.variety')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('estimacionCosecha.filters.allVarieties')}</SelectItem>
              {varietiesInUse.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 min-w-0 sm:col-span-2 lg:col-span-1">
          <label className="text-xs font-medium text-muted-foreground">{t('estimacionCosecha.filters.block')}</label>
          <Select value={filterBlock} onValueChange={setFilterBlock}>
            <SelectTrigger className="w-full h-9"><SelectValue placeholder={t('estimacionCosecha.filters.block')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('estimacionCosecha.filters.allBlocks')}</SelectItem>
              {blocksInUse.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {actions && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-3 border-t border-border/60">
          {actions}
        </div>
      )}
    </div>
  )

  const renderInspectorGate = () => {
    if (!isInspector) return null
    if (inspectorClients.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-10 text-center">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-amber-600 dark:text-amber-400 opacity-80" />
          <p className="font-medium text-foreground mb-1">{t('estimacionCosecha.inspector.noClientsTitle')}</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {t('estimacionCosecha.inspector.noClientsDesc')}
          </p>
        </div>
      )
    }
    if (!selectedClientId) {
      return (
        <div className="rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 p-10 text-center">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 text-emerald-600 dark:text-emerald-400 opacity-80" />
          <p className="font-medium text-foreground mb-1">{t('estimacionCosecha.inspector.selectClientTitle')}</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {t('estimacionCosecha.inspector.selectClientDesc')}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {isInspector && (
        <InspectorHarvestClientSelect
          clients={inspectorClients}
          value={selectedClientId}
          onValueChange={handleInspectorClientChange}
        />
      )}

      {!canEditHarvest && (
        <div className="rounded-lg border border-border/80 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t('estimacionCosecha.readOnlyBanner')}
        </div>
      )}

      {isInspector && !inspectorCanWork ? (
        renderInspectorGate()
      ) : (
      <>
      {canEditHarvest && (
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => setFieldsDialogOpen(true)} className="gap-2">
          <Trees className="w-4 h-4" /> {t('estimacionCosecha.buttons.fields', { count: fieldOptions.length })}
        </Button>
        <Button variant="outline" onClick={() => setBlocksDialogOpen(true)} className="gap-2">
          <MapPin className="w-4 h-4" /> {t('estimacionCosecha.buttons.blocks', { count: blocks.length })}
        </Button>
      </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => handleMainTabChange(v as HarvestEstimationTab)}>
        <TabsList className="w-full sm:w-auto h-auto flex-wrap">
          <TabsTrigger value="conteo" className="gap-2">
            <ClipboardList className="w-4 h-4" /> {t('estimacionCosecha.tabs.count')}
          </TabsTrigger>
          <TabsTrigger value="estimacion" className="gap-2">
            <BarChart3 className="w-4 h-4" /> {t('estimacionCosecha.tabs.estimation')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conteo" className="space-y-4 mt-4">
          {renderFilterPanel()}

          {(countRows.length > 0 || countSummaries.length > 0) && (
            <HarvestSeasonSummary
              totalKg={totals}
              missingHaCount={missingHaCount}
              lastRecordDate={lastRecordDate}
              computedCount={computedCount}
              savedCount={savedCount}
            />
          )}

          {(countRows.length > 0 || countSummaries.length > 0) &&
            (countAvgDardosByBlock.length > 0 || countAvgTwigsByBlock.length > 0 || countPrePostDardos.length > 0) && (
            <HarvestCountCharts
              avgDardosByBlock={countAvgDardosByBlock}
              avgTwigsByBlock={countAvgTwigsByBlock}
              prePostDardos={countPrePostDardos}
            />
          )}

          <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <p className="text-sm text-muted-foreground">
              {t('estimacionCosecha.countView.tableDesc')}
            </p>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={handleExportCount} className="gap-2" disabled={countRows.length === 0}>
                <Download className="w-4 h-4" /> {t('estimacionCosecha.buttons.exportExcel')}
              </Button>
              {canEditHarvest && (
                <Button onClick={openCreateCount} className="gap-2">
                  <Plus className="w-4 h-4" /> {t('estimacionCosecha.buttons.newCount')}
                </Button>
              )}
            </div>
          </div>

          {countRows.length === 0 && countSummaries.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-foreground mb-1">{t('estimacionCosecha.empty.noCountsTitle')}</p>
              <p className="text-sm mb-4">
                {canEditHarvest
                  ? t('estimacionCosecha.empty.noCountsDesc')
                  : t('estimacionCosecha.readOnlyBanner')}
              </p>
              {canEditHarvest && (
              <div className="flex gap-2 justify-center flex-wrap">
                <Button variant="outline" onClick={() => setFieldsDialogOpen(true)}>{t('estimacionCosecha.buttons.addFields')}</Button>
                <Button onClick={openCreateCount}>{t('estimacionCosecha.buttons.newCount')}</Button>
              </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <Tabs value={countView} onValueChange={(v) => setCountView(v as 'promedios' | 'muestras')}>
                  <TabsList className="h-9">
                    <TabsTrigger value="promedios" className="text-xs sm:text-sm">
                      {t('estimacionCosecha.countView.averages', { count: countSummaries.length })}
                    </TabsTrigger>
                    <TabsTrigger value="muestras" className="text-xs sm:text-sm">
                      {t('estimacionCosecha.countView.samples', { count: countRows.length })}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                {countRows.length > 0 && (
                  <p className="text-xs text-muted-foreground shrink-0">
                    {countView === 'promedios'
                      ? t('estimacionCosecha.countView.calculatedFrom', { count: countRows.length })
                      : t('estimacionCosecha.countView.recordsWithFilters', { count: countRows.length })}
                  </p>
                )}
              </div>

              {countView === 'promedios' ? (
                <div className="rounded-xl border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[1000px]">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left">
                          <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.field')}</th>
                          <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.block')}</th>
                          <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.variety')}</th>
                          <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.samples')}</th>
                          <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.avgSpur')}</th>
                          <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.avgTwigs')}</th>
                          <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {countSummaries.map((row) => {
                          const countState = row.count_state as HarvestCountState
                          const rowKey = countGroupKey(row)
                          return (
                            <tr key={rowKey} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="px-3 py-3 text-muted-foreground">{row.field_name || '—'}</td>
                              <td className="px-3 py-3 font-medium">{row.block_name}</td>
                              <td className="px-3 py-3">{row.variety}</td>
                              <td className="px-3 py-3 tabular-nums text-muted-foreground">{row.sample_count}</td>
                              <td className="px-3 py-3 tabular-nums font-medium">{fmtCountAvg(row.dardos_per_plant)}</td>
                              <td className="px-3 py-3 tabular-nums font-medium">{fmtCountAvg(row.dardos_per_branch)}</td>
                              <td className="px-3 py-3">
                                <Badge variant="outline" className={COUNT_STYLE[countState]}>{tCountState(t, countState)}</Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.field')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.block')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.variety')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.row')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.spur')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.twigs')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.status')}</th>
                      {canEditHarvest && <th className="px-3 py-3 w-20" />}
                    </tr>
                  </thead>
                  <tbody>
                    {countRows.map((row) => {
                      const countState = (row.count_state ?? 'Pre-poda') as HarvestCountState
                      return (
                        <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-3 text-muted-foreground">{row.field_name ?? '—'}</td>
                          <td className="px-3 py-3 font-medium">{row.block_name}</td>
                          <td className="px-3 py-3">{row.variety ?? row.crop}</td>
                          <td className="px-3 py-3 tabular-nums">{row.hilera ?? '—'}</td>
                          <td className="px-3 py-3 tabular-nums">{fmtCount(row.dardos_per_plant)}</td>
                          <td className="px-3 py-3 tabular-nums">{fmtCount(row.dardos_per_branch)}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge variant="outline" className={COUNT_STYLE[countState]}>{tCountState(t, countState)}</Badge>
                              <OfflinePendingBadge recordId={row.id} />
                            </div>
                          </td>
                          {canEditHarvest && (
                          <td className="px-3 py-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditCount(row)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(row)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="estimacion" className="space-y-4 mt-4">
          {renderFilterPanel()}

          {estimationDisplayRows.length > 0 && (
            <HarvestSeasonSummary
              totalKg={totals}
              missingHaCount={missingHaCount}
              lastRecordDate={lastRecordDate}
              computedCount={computedCount}
              savedCount={savedCount}
            />
          )}

          {prePostDeltaRows.length > 0 && (
            <HarvestPrePostTable rows={prePostDeltaRows} />
          )}

          {estimationDisplayRows.length > 0 && (
            <HarvestEstimationCharts
              byField={chartByField}
              byBlock={chartByBlock}
              byVariety={chartByVariety}
              prePostComparison={chartPrePostComparison}
              timeline={chartTimeline}
            />
          )}

          <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <p className="text-sm text-muted-foreground">
              {t('estimacionCosecha.estimationView.tableDesc')}
            </p>
            <div className="flex gap-2 shrink-0 flex-wrap">
              {canEditHarvest && computedCount > 0 && (
                <Button
                  variant="default"
                  onClick={handleSyncEstimations}
                  disabled={countSummaries.length === 0 || saving}
                  className="gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                  {t('estimacionCosecha.buttons.saveComputed', { count: computedCount })}
                </Button>
              )}
              {canEditHarvest && (
                <Button
                  variant="outline"
                  onClick={handleSyncEstimations}
                  disabled={countSummaries.length === 0 || saving}
                  className="gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                  {t('estimacionCosecha.buttons.calcFromCount')}
                </Button>
              )}
              <Button variant="outline" onClick={handleExportEstimation} className="gap-2" disabled={estimationDisplayRows.length === 0}>
                <Download className="w-4 h-4" /> {t('estimacionCosecha.buttons.exportExcel')}
              </Button>
              {canEditHarvest && (
                <Button onClick={openCreateEstimation} className="gap-2">
                  <Plus className="w-4 h-4" /> {t('estimacionCosecha.buttons.newEstimation')}
                </Button>
              )}
            </div>
          </div>

          {missingHaCount > 0 && countSummaries.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('estimacionCosecha.estimationView.missingHa', { count: missingHaCount })}
            </p>
          )}

          {estimationDisplayRows.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-foreground mb-1">{t('estimacionCosecha.empty.noEstimationsTitle')}</p>
              <p className="text-sm mb-4">
                {canEditHarvest
                  ? t('estimacionCosecha.empty.noEstimationsDesc')
                  : t('estimacionCosecha.readOnlyBanner')}
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button variant="outline" onClick={() => handleMainTabChange('conteo')}>{t('estimacionCosecha.buttons.goToCount')}</Button>
                {canEditHarvest && (
                  <Button onClick={openCreateEstimation}>{t('estimacionCosecha.buttons.newEstimation')}</Button>
                )}
              </div>
            </div>
          ) : (
            <>
            <HarvestEstimationCards
              rows={estimationDisplayRows}
              countStyle={COUNT_STYLE}
              readOnly={!canEditHarvest}
              onEdit={canEditHarvest ? (row) => openEditEstimation(row as HarvestEstimate) : undefined}
              onDelete={canEditHarvest ? (row) => handleDelete(row as HarvestEstimate) : undefined}
            />
            <div className="rounded-xl border overflow-hidden hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1600px]">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-3 font-medium w-28">{t('estimacionCosecha.table.status')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.field')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.block')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.variety')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.ha')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.plantsPerHa')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.spursPerPlant')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.spursPerBranch')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.primPerSpur')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.fruitSet')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.fruitsPerPlant')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.kgPerPlant')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.kgPerHa')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.estimatedKg')}</th>
                      <th className="px-3 py-3 font-medium">{t('estimacionCosecha.table.count')}</th>
                      {canEditHarvest && <th className="px-3 py-3 w-20" />}
                    </tr>
                  </thead>
                  <tbody>
                    {estimationDisplayRows.map((row) => {
                      const countState = (row.count_state ?? 'Pre-poda') as HarvestCountState
                      const canDelete = !row.id.startsWith('computed-')
                      return (
                      <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-1">
                            <HarvestRowBadge rowId={row.id} />
                            <OfflinePendingBadge recordId={row.id} />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{row.field_name ?? '—'}</td>
                        <td className="px-3 py-3 font-medium">{row.block_name}</td>
                        <td className="px-3 py-3">{row.variety ?? row.crop}</td>
                        <td className="px-3 py-3 tabular-nums">{row.hectares ?? '—'}</td>
                        <td className="px-3 py-3 tabular-nums">{row.plants_per_ha ?? '—'}</td>
                        <td className="px-3 py-3 tabular-nums">{fmtCount(row.dardos_per_plant)}</td>
                        <td className="px-3 py-3 tabular-nums">{fmtCount(row.dardos_per_branch)}</td>
                        <td className="px-3 py-3 tabular-nums">{row.primordia_per_dardo ?? '—'}</td>
                        <td className="px-3 py-3 tabular-nums">{fmtPct(row.fruit_set_pct)}</td>
                        <td className="px-3 py-3 tabular-nums">{row.fruits_set != null ? fmtCount(row.fruits_set) : '—'}</td>
                        <td className="px-3 py-3 tabular-nums">{row.kg_per_plant != null ? fmtCount(row.kg_per_plant) : '—'}</td>
                        <td className="px-3 py-3 tabular-nums">{row.kg_per_ha != null ? formatKg(row.kg_per_ha) : '—'}</td>
                        <td className="px-3 py-3 font-medium tabular-nums">{formatKg(Number(row.estimated_kg))}</td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className={COUNT_STYLE[countState]}>{tCountState(t, countState)}</Badge>
                        </td>
                        {canEditHarvest && (
                        <td className="px-3 py-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditEstimation(row)} title={t('estimacionCosecha.buttons.editEstimation')}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {canDelete && (
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(row)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </td>
                        )}
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
            </>
          )}
        </TabsContent>

      </Tabs>
      </>
      )}

      {/* Dialog campos */}
      <Dialog open={fieldsDialogOpen} onOpenChange={setFieldsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('estimacionCosecha.dialogs.myFields')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {t('estimacionCosecha.dialogs.fieldsHint')}
            </p>
            <div className="flex gap-2">
              <Input
                value={fieldFormName}
                onChange={(e) => setFieldFormName(e.target.value)}
                placeholder={t('estimacionCosecha.dialogs.fieldNamePlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveField()}
              />
              <Button onClick={handleSaveField} disabled={saving} className="shrink-0 gap-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t('estimacionCosecha.buttons.addField')}
              </Button>
            </div>
            {fields.length > 0 || orphanFieldNames.length > 0 ? (
              <div className="rounded-lg border divide-y max-h-56 overflow-y-auto">
                {fields.map((f) => (
                  <div key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="font-medium">{f.name}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteField(f.id, f.name)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {orphanFieldNames.map((name) => (
                  <div key={`orphan-${name}`} className="flex items-center justify-between px-3 py-2 text-sm bg-muted/20">
                    <span className="font-medium">{name}</span>
                    <Badge variant="secondary" className="text-[10px]">{t('estimacionCosecha.badges.inBlocksEstimations')}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                {t('estimacionCosecha.empty.noFields')}
              </p>
            )}
            {fields.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={handleDeleteAllFields}
                disabled={saving}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('estimacionCosecha.buttons.deleteAllFields')}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog cuarteles */}
      <Dialog open={blocksDialogOpen} onOpenChange={setBlocksDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('estimacionCosecha.dialogs.myBlocks')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t('estimacionCosecha.filters.field')} *</label>
                {hasFieldOptions ? (
                  <Select
                    value={blockForm.field_name || 'none'}
                    onValueChange={(v) => setBlockForm({
                      ...blockForm,
                      field_name: v === 'none' ? '' : v,
                    })}
                  >
                    <SelectTrigger><SelectValue placeholder={t('estimacionCosecha.dialogs.selectField')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('estimacionCosecha.dialogs.selectPlaceholder')}</SelectItem>
                      {fieldOptions.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={blockForm.field_name}
                    onChange={(e) => setBlockForm({ ...blockForm, field_name: e.target.value })}
                    placeholder={t('estimacionCosecha.dialogs.fieldExample')}
                  />
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('estimacionCosecha.filters.block')} *</label>
                <Input
                  value={blockForm.block_name}
                  onChange={(e) => setBlockForm({ ...blockForm, block_name: e.target.value })}
                  placeholder={t('estimacionCosecha.dialogs.blockExample')}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('estimacionCosecha.filters.crop')}</label>
                <Select
                  value={blockForm.crop}
                  onValueChange={(v) => setBlockForm({ ...blockForm, crop: v as HarvestCrop, variety: '' })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HARVEST_CROPS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('estimacionCosecha.filters.variety')}</label>
                <Select value={blockForm.variety} onValueChange={(v) => setBlockForm({ ...blockForm, variety: v })}>
                  <SelectTrigger><SelectValue placeholder={t('estimacionCosecha.dialogs.optional')} /></SelectTrigger>
                  <SelectContent>
                    {getVarietiesForCrop(blockForm.crop).map((v) => (
                      <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('estimacionCosecha.dialogs.hectares')}</label>
                <Input type="number" step="0.01" value={blockForm.hectares} onChange={(e) => setBlockForm({ ...blockForm, hectares: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('estimacionCosecha.table.plantsPerHa')}</label>
                <Input type="number" value={blockForm.plants_per_ha} onChange={(e) => setBlockForm({ ...blockForm, plants_per_ha: e.target.value })} />
              </div>
            </div>
            {!hasFieldOptions && (
              <Button variant="link" className="h-auto p-0 text-xs" onClick={() => { setBlocksDialogOpen(false); setFieldsDialogOpen(true) }}>
                {t('estimacionCosecha.buttons.addFieldFirst')}
              </Button>
            )}
            <Button onClick={handleSaveBlock} disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t('estimacionCosecha.buttons.addBlock')}
            </Button>

            {blocks.length > 0 && (
              <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
                {blocks.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{b.block_name}</span>
                      <span className="text-muted-foreground"> · {b.field_name}</span>
                      {b.hectares != null && (
                        <span className="text-xs text-muted-foreground"> · {b.hectares} ha</span>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteBlock(b.id, b.block_name)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {blocks.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={handleDeleteAllBlocks}
                disabled={saving}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('estimacionCosecha.buttons.deleteAllBlocks')}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog conteo / estimación */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'estimacion'
                ? (editing ? t('estimacionCosecha.dialogs.editEstimation') : t('estimacionCosecha.dialogs.newEstimation'))
                : (editing ? t('estimacionCosecha.dialogs.editCount') : t('estimacionCosecha.dialogs.newCount'))}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {(dialogMode === 'conteo' || dialogMode === 'estimacion') && (
              <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t('estimacionCosecha.dialogs.date')}</label>
                <Input type="date" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('estimacionCosecha.filters.season')}</label>
                <Input value={form.season_label} onChange={(e) => setForm({ ...form, season_label: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('estimacionCosecha.filters.field')} *</label>
                {hasFieldOptions ? (
                  <Select
                    value={form.field_name || 'none'}
                    onValueChange={(v) => setForm((prev) => ({
                      ...prev,
                      field_name: v === 'none' ? '' : v,
                      block_id: '',
                      block_name: '',
                    }))}
                  >
                    <SelectTrigger><SelectValue placeholder={t('estimacionCosecha.dialogs.selectField')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('estimacionCosecha.dialogs.selectPlaceholder')}</SelectItem>
                      {fieldOptions.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.field_name}
                    onChange={(e) => setForm({ ...form, field_name: e.target.value })}
                    placeholder={t('estimacionCosecha.dialogs.fieldExample')}
                  />
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('estimacionCosecha.dialogs.areaHa')}</label>
                <Input type="number" step="0.01" min="0" value={form.hectares} onChange={(e) => setForm({ ...form, hectares: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">{t('estimacionCosecha.filters.block')} *</label>
                {blocksForSelectedField.length > 0 ? (
                  <Select
                    value={form.block_id || 'manual'}
                    onValueChange={(v) => {
                      if (v === 'manual') {
                        setForm((prev) => ({ ...prev, block_id: '', block_name: '' }))
                        return
                      }
                      const block = blocks.find((b) => b.id === v)
                      if (block) applyBlockToForm(block)
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder={t('estimacionCosecha.dialogs.selectBlock')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">{t('estimacionCosecha.dialogs.writeManual')}</SelectItem>
                      {blocksForSelectedField.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.block_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.block_name}
                    onChange={(e) => setForm({ ...form, block_name: e.target.value, block_id: '' })}
                    placeholder={t('estimacionCosecha.dialogs.blockExample')}
                  />
                )}
              </div>
              {(form.block_id === '' || blocksForSelectedField.length === 0) && (
                <div>
                  <label className="text-xs text-muted-foreground">{t('estimacionCosecha.dialogs.blockName')}</label>
                  <Input
                    value={form.block_name}
                    onChange={(e) => setForm({ ...form, block_name: e.target.value, block_id: '' })}
                    placeholder={t('estimacionCosecha.dialogs.blockExample')}
                  />
                </div>
              )}
            </div>
            {!hasFieldOptions && (
              <Button variant="link" className="h-auto p-0 text-xs justify-start" onClick={() => { setDialogOpen(false); setFieldsDialogOpen(true) }}>
                {t('estimacionCosecha.buttons.addFieldsToAccount')}
              </Button>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{t('estimacionCosecha.dialogs.species')}</label>
                <Select value={form.crop} onValueChange={(v) => handleCropChange(v as HarvestCrop)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HARVEST_CROPS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('estimacionCosecha.filters.variety')} *</label>
                <Select value={form.variety} onValueChange={handleVarietyChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {varietyOptions.map((v) => (
                      <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isCherry && (
                <div>
                  <label className="text-xs text-muted-foreground">{t('estimacionCosecha.dialogs.countState')}</label>
                  <Select value={form.count_state} onValueChange={(v) => setForm({ ...form, count_state: v as HarvestCountState })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HARVEST_COUNT_STATES.map((s) => (
                        <SelectItem key={s} value={s}>{tCountState(t, s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {dialogMode === 'conteo' && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">{t('estimacionCosecha.table.row')}</label>
                    <Input type="number" min="0" value={form.hilera} onChange={(e) => setForm({ ...form, hilera: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">{t('estimacionCosecha.dialogs.tree')}</label>
                    <Input type="number" min="0" value={form.arbol} onChange={(e) => setForm({ ...form, arbol: e.target.value })} />
                  </div>
                </>
              )}
            </div>

            {isCherry ? (
              <>
                <div className="rounded-lg border p-3 space-y-3">
                  <p className="text-xs font-medium text-foreground">
                    {dialogMode === 'estimacion' ? t('estimacionCosecha.dialogs.estimationParams') : t('estimacionCosecha.dialogs.phenologyCount')}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">{t('estimacionCosecha.table.plantsPerHa')}</label>
                      <Input type="number" value={form.plants_per_ha} onChange={(e) => setForm({ ...form, plants_per_ha: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{t('estimacionCosecha.dialogs.spursPerPlant')}</label>
                      <Input type="number" step="0.1" value={form.dardos_per_plant} onChange={(e) => setForm({ ...form, dardos_per_plant: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{t('estimacionCosecha.dialogs.spursPerBranch')}</label>
                      <Input type="number" step="0.1" value={form.dardos_per_branch} onChange={(e) => setForm({ ...form, dardos_per_branch: e.target.value })} />
                    </div>
                    {dialogMode === 'conteo' && (
                      <div>
                        <label className="text-xs text-muted-foreground">{t('estimacionCosecha.dialogs.coralSpur')}</label>
                        <Input type="number" step="0.1" value={form.dardo_coral} onChange={(e) => setForm({ ...form, dardo_coral: e.target.value })} />
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-muted-foreground">{t('estimacionCosecha.dialogs.fruitSet')}</label>
                      <Input type="number" step="0.01" min="0" max="1" value={form.fruit_set_pct} onChange={(e) => setForm({ ...form, fruit_set_pct: e.target.value })} placeholder="0.20" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{t('estimacionCosecha.dialogs.primPerSpur')}</label>
                      <Input type="number" step="0.01" value={form.primordia_per_dardo} onChange={(e) => setForm({ ...form, primordia_per_dardo: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{t('estimacionCosecha.dialogs.primPerBranch')}</label>
                      <Input type="number" step="0.01" value={form.primordia_per_branch} onChange={(e) => setForm({ ...form, primordia_per_branch: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">{t('estimacionCosecha.dialogs.fruitWeight')}</label>
                      <Input type="number" step="0.001" value={form.fruit_weight_kg} onChange={(e) => setForm({ ...form, fruit_weight_kg: e.target.value })} />
                    </div>
                  </div>
                </div>
                <ExcelCalcPanel form={form} t={t} />
              </>
            ) : (
              computedLive && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                  <p className="text-muted-foreground mb-1">{HARVEST_FORMULA_HINT[form.crop]}</p>
                  <p className="font-medium">{t('estimacionCosecha.dialogs.totalKg', { kg: formatKg(computedLive.estimatedKg) })}</p>
                </div>
              )
            )}

            {dialogMode === 'conteo' && (
              <div>
                <label className="text-xs text-muted-foreground">{t('common.labels.notes')}</label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder={t('estimacionCosecha.dialogs.notesPlaceholder')}
                />
              </div>
            )}

              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.actions.cancel')}</Button>
            <Button
              onClick={handleSave}
              disabled={!canSaveDialog}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t('common.actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

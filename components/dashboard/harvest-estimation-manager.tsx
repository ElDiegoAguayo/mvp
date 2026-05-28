'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getEffectiveUserId } from '@/lib/supabase/effective-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2, Plus, Pencil, Trash2, BarChart3, CalendarRange, MapPin, Trees, FileSpreadsheet, Upload, Download, ClipboardList,
} from 'lucide-react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  clearAllHarvestDataAction,
  deleteAllHarvestBlocksAction,
  deleteAllHarvestFieldsAction,
  importCountFromExcelAction,
  importEstimationFromExcelAction,
  syncEstimationsFromCountAction,
} from '@/app/actions/harvest-import-actions'
import { parseHarvestWorkbook, type ParsedHarvestImport } from '@/lib/agronomy/parse-harvest-xlsx'
import { parseCountWorkbook, isBellavistaDashboardWorkbook } from '@/lib/agronomy/parse-count-xlsx'
import * as XLSX from 'xlsx'
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
import { HarvestEstimationCharts } from '@/components/dashboard/harvest/harvest-estimation-charts'

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
  expected_start: string
  expected_end: string
  status: HarvestStatus
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
    expected_start: '',
    expected_end: '',
    status: 'planificado',
  }
}

const STATUS_STYLE: Record<HarvestStatus, string> = {
  planificado: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  en_curso: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  finalizado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
}

const COUNT_STYLE: Record<HarvestCountState, string> = {
  'Pre-poda': 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30',
  'Post-poda': 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
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

function ExcelCalcPanel({ form }: { form: FormState }) {
  const params = computeCherryHarvestLive(form)
  if (!params) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        Completa superficie, plantas/ha y parámetros de referencia para ver los cálculos.
      </div>
    )
  }

  const steps = getCherryCalculationSteps(params)
  const pct = params.fruitSetPct <= 1 ? Math.round(params.fruitSetPct * 100) : params.fruitSetPct

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-xs font-medium">Cálculo automático (como Excel)</p>
      <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
        Frutos = ({fmtNum(params.dardosPerPlant, 1)} × {fmtNum(params.primordiaPerDardo, 2)}
        {' + '}{fmtNum(params.dardosPerBranch, 1)} × {fmtNum(params.primordiaPerBranch, 2)}) × {pct}%
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: 'Frutos cuajados', value: fmtNum(steps.fruitsSet, 2) },
          { label: 'Peso fruto (kg)', value: fmtNum(steps.fruitWeightKg, 3) },
          { label: 'Kg/planta', value: fmtNum(steps.kgPerPlant, 4) },
          { label: 'Kg/ha', value: fmtNum(steps.kgPerHa, 1) },
          { label: 'Kg totales', value: fmtNum(steps.kgTotal, 0) },
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

export function HarvestEstimationManager() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<HarvestEstimate[]>([])
  const [blocks, setBlocks] = useState<HarvestBlock[]>([])
  const [fields, setFields] = useState<HarvestField[]>([])
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [blocksDialogOpen, setBlocksDialogOpen] = useState(false)
  const [fieldsDialogOpen, setFieldsDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'conteo' | 'estimacion'>('conteo')
  const [countView, setCountView] = useState<'promedios' | 'muestras'>('promedios')
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importMode, setImportMode] = useState<'conteo' | 'estimacion'>('conteo')
  const [importPreview, setImportPreview] = useState<ParsedHarvestImport | null>(null)
  const [importReplace, setImportReplace] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
  const [filterField, setFilterField] = useState<string>('all')
  const [filterCountState, setFilterCountState] = useState<string>('all')
  const [filterVariety, setFilterVariety] = useState<string>('all')
  const [filterBlock, setFilterBlock] = useState<string>('all')

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

  const load = useCallback(async () => {
    setLoading(true)
    const { effectiveUserId } = await getEffectiveUserId(supabase)
    if (!effectiveUserId) {
      setLoading(false)
      return
    }
    setOwnerId(effectiveUserId)

    const [estRes, blockRes, fieldRes] = await Promise.all([
      supabase
        .from('harvest_estimates')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('record_date', { ascending: false }),
      supabase
        .from('harvest_blocks')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('field_name')
        .order('block_name'),
      supabase
        .from('harvest_fields')
        .select('id, name')
        .eq('user_id', effectiveUserId)
        .order('name'),
    ])

    if (estRes.error) toast.error('No se pudieron cargar las estimaciones')
    else setRows((estRes.data ?? []) as HarvestEstimate[])

    const loadedBlocks = blockRes.error ? [] : ((blockRes.data ?? []) as HarvestBlock[])
    const loadedRows = estRes.error ? [] : ((estRes.data ?? []) as HarvestEstimate[])
    const loadedFields = fieldRes.error ? [] : ((fieldRes.data ?? []) as HarvestField[])

    if (blockRes.error) console.error(blockRes.error)
    else setBlocks(loadedBlocks)

    if (fieldRes.error) console.error(fieldRes.error)

    const catalogNames = new Set(loadedFields.map((f) => f.name))
    const orphanNames = [
      ...new Set([
        ...loadedRows.map((r) => r.field_name?.trim()).filter(Boolean) as string[],
        ...loadedBlocks.map((b) => b.field_name?.trim()).filter(Boolean) as string[],
      ].filter((name) => !catalogNames.has(name))),
    ]

    if (orphanNames.length > 0) {
      const { error: syncError } = await supabase.from('harvest_fields').upsert(
        orphanNames.map((name) => ({ user_id: effectiveUserId, name })),
        { onConflict: 'user_id,name', ignoreDuplicates: true },
      )
      if (syncError) {
        console.error(syncError)
        setFields(loadedFields)
      } else {
        const { data: syncedFields } = await supabase
          .from('harvest_fields')
          .select('id, name')
          .eq('user_id', effectiveUserId)
          .order('name')
        setFields((syncedFields ?? loadedFields) as HarvestField[])
      }
    } else {
      setFields(loadedFields)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const seasonFiltered = useMemo(() => rows.filter((r) => {
    if (filterSeason && r.season_label !== filterSeason) return false
    if (filterField !== 'all' && (r.field_name ?? '') !== filterField) return false
    if (filterCountState !== 'all' && (r.count_state ?? 'Pre-poda') !== filterCountState) return false
    return true
  }), [rows, filterSeason, filterField, filterCountState])

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
  }, [filterSeason, filterField, filterCountState])

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
      }
    })
  }, [countSummaries, blocks, estimationRows, filterSeason, seasons])

  const totals = useMemo(
    () => estimationDisplayRows.reduce((s, r) => s + Number(r.estimated_kg), 0),
    [estimationDisplayRows],
  )

  const totalsByField = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of estimationDisplayRows) {
      const key = r.field_name || 'Sin campo'
      map.set(key, (map.get(key) ?? 0) + Number(r.estimated_kg))
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [estimationDisplayRows])

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

  const missingHaCount = useMemo(
    () => estimationDisplayRows.filter((r) => !r.hectares || r.hectares <= 0).length,
    [estimationDisplayRows],
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
    setDialogMode('conteo')
    setEditing(null)
    setForm(buildEmptyForm(filterSeason || currentSeasonLabel()))
    setDialogOpen(true)
  }

  function openCreateEstimation() {
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
      expected_start: row.expected_start ?? '',
      expected_end: row.expected_end ?? '',
      status: row.status,
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

  async function handleClearAllData() {
    if (!confirm('¿Eliminar TODOS tus campos, cuarteles y estimaciones? Esta acción no se puede deshacer.')) return
    setSaving(true)
    const result = await clearAllHarvestDataAction()
    setSaving(false)
    if (!result.ok) {
      toast.error('No se pudo vaciar', { description: result.error })
      return
    }
    toast.success('Datos eliminados')
    setImportPreview(null)
    load()
  }

  async function handleDeleteAllFields() {
    if (!confirm(`¿Eliminar los ${fieldOptions.length} campos registrados?`)) return
    setSaving(true)
    const result = await deleteAllHarvestFieldsAction()
    setSaving(false)
    if (!result.ok) toast.error(result.error)
    else { toast.success('Campos eliminados'); load() }
  }

  async function handleDeleteAllBlocks() {
    if (!confirm(`¿Eliminar los ${blocks.length} cuarteles registrados?`)) return
    setSaving(true)
    const result = await deleteAllHarvestBlocksAction()
    setSaving(false)
    if (!result.ok) toast.error(result.error)
    else { toast.success('Cuarteles eliminados'); load() }
  }

  function handleExportCount() {
    if (countRows.length === 0) {
      toast.error('No hay conteos para exportar con los filtros actuales')
      return
    }
    exportCountToExcel(countRows, filterSeason || undefined)
    toast.success('Excel de conteo descargado', {
      description: `${countRows.length} muestras exportadas`,
    })
  }

  function handleExportEstimation() {
    if (estimationDisplayRows.length === 0) {
      toast.error('No hay estimaciones para exportar con los filtros actuales')
      return
    }
    exportHarvestToExcel(estimationDisplayRows, filterSeason || undefined)
    toast.success('Excel de estimación descargado', {
      description: `${estimationDisplayRows.length} estimaciones exportadas`,
    })
  }

  async function handleSyncEstimations() {
    setSaving(true)
    const result = await syncEstimationsFromCountAction(filterSeason || undefined)
    setSaving(false)
    if (!result.ok) {
      toast.error('No se pudo calcular', { description: result.error })
      return
    }
    toast.success('Estimaciones actualizadas', {
      description: `${result.updated} cuarteles calculados desde promedios de conteo`,
    })
    load()
  }

  function openImportDialog(mode: 'conteo' | 'estimacion') {
    setImportMode(mode)
    setImportPreview(null)
    if (mode === 'conteo') setActiveTab('conteo')
    setImportDialogOpen(true)
  }

  async function handleFileSelect(file: File, mode: 'conteo' | 'estimacion') {
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      let effectiveMode = mode

      if (isBellavistaDashboardWorkbook(wb)) {
        effectiveMode = 'conteo'
        setImportMode('conteo')
        setActiveTab('conteo')
        if (mode === 'estimacion') {
          toast.info('Excel de conteo detectado', {
            description: 'Dashboard Agrícola con Dardo/Ramillas → se importa solo en Conteo.',
          })
        }
      }

      const parsed = effectiveMode === 'conteo'
        ? parseCountWorkbook(buffer)
        : parseHarvestWorkbook(buffer)
      setImportPreview(parsed)
      toast.success(effectiveMode === 'conteo' ? 'Conteo leído' : 'Estimación leída', {
        description: `${parsed.estimates.length} cuarteles · ${parsed.source_row_count ?? parsed.estimates.length} filas procesadas`,
      })
    } catch (err) {
      toast.error('No se pudo leer el Excel', {
        description: err instanceof Error ? err.message : 'Formato no válido',
      })
      setImportPreview(null)
    }
  }

  async function handleConfirmImport() {
    if (!importPreview) return
    setImporting(true)
    const result = importMode === 'conteo'
      ? await importCountFromExcelAction(importPreview, importReplace)
      : await importEstimationFromExcelAction(importPreview, importReplace)
    setImporting(false)
    if (!result.ok) {
      toast.error('Importación fallida', { description: result.error })
      return
    }
    toast.success(importMode === 'conteo' ? 'Conteo importado' : 'Estimación importada', {
      description: `${result.fields} campos · ${result.blocks} cuarteles · ${result.estimates} registros`,
    })
    if (importMode === 'conteo') {
      const sync = await syncEstimationsFromCountAction(importPreview.season_label)
      if (sync.ok) {
        toast.success('Estimación calculada', {
          description: `${sync.updated} cuarteles con kg desde promedios de conteo`,
        })
      }
    }
    setImportDialogOpen(false)
    setImportPreview(null)
    setFilterSeason(result.season)
    if (importMode === 'conteo') setActiveTab('estimacion')
    else setActiveTab('estimacion')
    load()
  }

  async function handleSaveField() {
    if (!ownerId) return
    if (!fieldFormName.trim()) {
      toast.error('Indica el nombre del campo')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('harvest_fields').upsert({
      user_id: ownerId,
      name: fieldFormName.trim(),
    }, { onConflict: 'user_id,name' })
    setSaving(false)
    if (error) {
      toast.error('No se pudo crear el campo', { description: error.message })
      return
    }
    toast.success('Campo agregado')
    setFieldFormName('')
    load()
  }

  async function handleDeleteField(id: string, name: string) {
    if (!confirm(`¿Eliminar campo "${name}"? Los cuarteles y estimaciones existentes conservan el nombre.`)) return
    const { error } = await supabase.from('harvest_fields').delete().eq('id', id)
    if (error) toast.error('No se pudo eliminar')
    else { toast.success('Campo eliminado'); load() }
  }

  async function handleSaveBlock() {
    if (!ownerId) return
    if (!blockForm.field_name.trim() || !blockForm.block_name.trim()) {
      toast.error('Campo y cuartel son obligatorios')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('harvest_blocks').insert({
      user_id: ownerId,
      field_name: blockForm.field_name.trim(),
      block_name: blockForm.block_name.trim(),
      crop: blockForm.crop,
      variety: blockForm.variety.trim() || null,
      hectares: blockForm.hectares ? Number(blockForm.hectares) : null,
      plants_per_ha: blockForm.plants_per_ha ? Number(blockForm.plants_per_ha) : null,
    })
    setSaving(false)
    if (error) {
      toast.error('No se pudo crear el cuartel', { description: error.message })
      return
    }
    toast.success('Cuartel agregado')
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
    if (!confirm(`¿Eliminar cuartel ${name}?`)) return
    const { error } = await supabase.from('harvest_blocks').delete().eq('id', id)
    if (error) toast.error('No se pudo eliminar')
    else { toast.success('Cuartel eliminado'); load() }
  }

  async function handleSave() {
    if (!ownerId) return

    const isEstimation = dialogMode === 'estimacion'
    const isComputedEdit = editing?.id?.startsWith('computed-')

    if (!form.block_name.trim() || !form.crop.trim()) {
      toast.error('Selecciona o indica un cuartel')
      return
    }
    if (!form.field_name.trim()) {
      toast.error('Selecciona o indica un campo')
      return
    }
    if (!form.variety.trim()) {
      toast.error('Selecciona una variedad')
      return
    }
    if (!form.record_date) {
      toast.error('Indica la fecha de la estimación')
      return
    }

    const saveForm = isEstimation && editing
      ? formWithEstimationFallbacks(form, editing)
      : form

    const result = computeFromForm(saveForm, true)
    if (!result) {
      toast.error(isEstimation
        ? 'Completa superficie, plantas/ha y parámetros para calcular la estimación'
        : 'Completa el conteo fenológico y la superficie para calcular')
      return
    }

    setSaving(true)

    if (isEstimation && Number(saveForm.hectares) > 0) {
      await supabase.from('harvest_blocks').upsert({
        user_id: ownerId,
        field_name: saveForm.field_name.trim(),
        block_name: saveForm.block_name.trim(),
        crop: saveForm.crop.trim(),
        variety: saveForm.variety.trim() || null,
        hectares: Number(saveForm.hectares),
        plants_per_ha: Number(saveForm.plants_per_ha) || null,
      }, { onConflict: 'user_id,field_name,block_name' })
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
      estimated_kg: result.estimatedKg,
      harvested_kg: Number(saveForm.harvested_kg) || 0,
      expected_start: saveForm.expected_start || null,
      expected_end: saveForm.expected_end || null,
      status: saveForm.status,
      count_state: isCherry ? saveForm.count_state : null,
      is_count_summary: isEstimation,
      hilera: isEstimation ? null : (editing?.hilera ?? null),
      arbol: isEstimation ? null : (editing?.arbol ?? null),
      count_sample_count: isEstimation
        ? (editing?.count_sample_count ?? 1)
        : (editing?.count_sample_count ?? 1),
      updated_at: new Date().toISOString(),
    }

    if (isCherry && result.fruitsSet != null) {
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
        fruits_set: result.fruitsSet,
        fruit_weight_kg: Number(saveForm.fruit_weight_kg),
        kg_per_plant: result.kgPerPlant,
        kg_per_ha: result.kgPerHa,
      })
    } else {
      Object.assign(payload, {
        kg_per_ha: result.kgPerHa,
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

    const { error } = targetId && !targetId.startsWith('computed-')
      ? await supabase.from('harvest_estimates').update(payload).eq('id', targetId)
      : await supabase.from('harvest_estimates').insert(payload)

    setSaving(false)
    if (error) {
      toast.error('Error al guardar', { description: error.message })
      return
    }
    toast.success(
      isEstimation
        ? (targetId && !targetId.startsWith('computed-') ? 'Estimación actualizada' : 'Estimación registrada')
        : (editing ? 'Conteo actualizado' : 'Conteo registrado'),
    )
    setDialogOpen(false)
    load()
  }

  async function handleDelete(row: HarvestEstimate) {
    if (row.id.startsWith('computed-')) {
      toast.error('Calcula o crea la estimación primero', {
        description: 'Usa "Calcular desde conteo" o "Nueva estimación" para guardarla.',
      })
      return
    }
    if (!confirm(`¿Eliminar estimación de ${row.block_name}?`)) return
    const { error } = await supabase.from('harvest_estimates').delete().eq('id', row.id)
    if (error) toast.error('No se pudo eliminar')
    else { toast.success('Eliminado'); load() }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Cargando estimaciones…
      </div>
    )
  }

  const renderFilterPanel = (actions?: React.ReactNode) => (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <div className="space-y-1.5 min-w-0">
          <label className="text-xs font-medium text-muted-foreground">Temporada</label>
          <Select value={filterSeason} onValueChange={setFilterSeason}>
            <SelectTrigger className="w-full h-9"><SelectValue placeholder="Temporada" /></SelectTrigger>
            <SelectContent>
              {seasons.length === 0 && (
                <SelectItem value={currentSeasonLabel()}>{currentSeasonLabel()}</SelectItem>
              )}
              {seasons.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 min-w-0">
          <label className="text-xs font-medium text-muted-foreground">Campo</label>
          <Select value={filterField} onValueChange={setFilterField}>
            <SelectTrigger className="w-full h-9"><SelectValue placeholder="Campo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los campos</SelectItem>
              {fieldOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 min-w-0">
          <label className="text-xs font-medium text-muted-foreground">Conteo</label>
          <Select value={filterCountState} onValueChange={setFilterCountState}>
            <SelectTrigger className="w-full h-9"><SelectValue placeholder="Conteo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Pre + Post poda</SelectItem>
              {HARVEST_COUNT_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 min-w-0">
          <label className="text-xs font-medium text-muted-foreground">Variedad</label>
          <Select value={filterVariety} onValueChange={setFilterVariety}>
            <SelectTrigger className="w-full h-9"><SelectValue placeholder="Variedad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las variedades</SelectItem>
              {varietiesInUse.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 min-w-0 sm:col-span-2 lg:col-span-1">
          <label className="text-xs font-medium text-muted-foreground">Cuartel</label>
          <Select value={filterBlock} onValueChange={setFilterBlock}>
            <SelectTrigger className="w-full h-9"><SelectValue placeholder="Cuartel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los cuarteles</SelectItem>
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

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => setFieldsDialogOpen(true)} className="gap-2">
          <Trees className="w-4 h-4" /> Campos ({fieldOptions.length})
        </Button>
        <Button variant="outline" onClick={() => setBlocksDialogOpen(true)} className="gap-2">
          <MapPin className="w-4 h-4" /> Cuarteles ({blocks.length})
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'conteo' | 'estimacion')}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="conteo" className="gap-2">
            <ClipboardList className="w-4 h-4" /> Conteo
          </TabsTrigger>
          <TabsTrigger value="estimacion" className="gap-2">
            <BarChart3 className="w-4 h-4" /> Estimación de cosecha
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conteo" className="space-y-4 mt-4">
          {renderFilterPanel(
            <>
              <Button variant="outline" size="sm" onClick={handleExportCount} className="gap-2" disabled={countRows.length === 0}>
                <Download className="w-4 h-4" /> Exportar Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => openImportDialog('conteo')} className="gap-2">
                <Upload className="w-4 h-4" /> Importar Excel
              </Button>
              <Button size="sm" onClick={openCreateCount} className="gap-2">
                <Plus className="w-4 h-4" /> Nuevo conteo
              </Button>
            </>,
          )}

          {countRows.length === 0 && countSummaries.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-foreground mb-1">Sin conteos registrados</p>
              <p className="text-sm mb-4">
                Registra dardos, primordios y % cuaja por cuartel. Los kg se calculan automáticamente.
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button variant="outline" onClick={() => openImportDialog('conteo')} className="gap-2">
                  <Upload className="w-4 h-4" /> Importar Excel
                </Button>
                <Button variant="outline" onClick={() => setFieldsDialogOpen(true)}>Agregar campos</Button>
                <Button onClick={openCreateCount}>Nuevo conteo</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <Tabs value={countView} onValueChange={(v) => setCountView(v as 'promedios' | 'muestras')}>
                  <TabsList className="h-9">
                    <TabsTrigger value="promedios" className="text-xs sm:text-sm">
                      Promedios por cuartel ({countSummaries.length})
                    </TabsTrigger>
                    <TabsTrigger value="muestras" className="text-xs sm:text-sm">
                      Detalle por árbol ({countRows.length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                {countRows.length > 0 && (
                  <p className="text-xs text-muted-foreground shrink-0">
                    {countView === 'promedios'
                      ? `Calculado desde ${countRows.length} muestras`
                      : `${countRows.length} registro(s) con filtros actuales`}
                  </p>
                )}
              </div>

              {countView === 'promedios' ? (
                <div className="rounded-xl border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[1000px]">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left">
                          <th className="px-3 py-3 font-medium">Campo</th>
                          <th className="px-3 py-3 font-medium">Cuartel</th>
                          <th className="px-3 py-3 font-medium">Variedad</th>
                          <th className="px-3 py-3 font-medium">Muestras</th>
                          <th className="px-3 py-3 font-medium">Prom. Arbol</th>
                          <th className="px-3 py-3 font-medium">Prom. Dardo</th>
                          <th className="px-3 py-3 font-medium">Prom. Ramillas</th>
                          <th className="px-3 py-3 font-medium">Prom. Dardo Coral</th>
                          <th className="px-3 py-3 font-medium">Estado</th>
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
                              <td className="px-3 py-3 tabular-nums font-medium">{fmtCountAvg(row.arbol)}</td>
                              <td className="px-3 py-3 tabular-nums font-medium">{fmtCountAvg(row.dardos_per_plant)}</td>
                              <td className="px-3 py-3 tabular-nums font-medium">{fmtCountAvg(row.dardos_per_branch)}</td>
                              <td className="px-3 py-3 tabular-nums font-medium">{fmtCountAvg(row.dardo_coral)}</td>
                              <td className="px-3 py-3">
                                <Badge variant="outline" className={COUNT_STYLE[countState]}>{countState}</Badge>
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
                      <th className="px-3 py-3 font-medium">Campo</th>
                      <th className="px-3 py-3 font-medium">Cuartel</th>
                      <th className="px-3 py-3 font-medium">Variedad</th>
                      <th className="px-3 py-3 font-medium">Hilera</th>
                      <th className="px-3 py-3 font-medium">Arbol</th>
                      <th className="px-3 py-3 font-medium">Dardo</th>
                      <th className="px-3 py-3 font-medium">Ramillas</th>
                      <th className="px-3 py-3 font-medium">Dardo Coral</th>
                      <th className="px-3 py-3 font-medium">Estado</th>
                      <th className="px-3 py-3 w-20" />
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
                          <td className="px-3 py-3 tabular-nums">{row.arbol ?? '—'}</td>
                          <td className="px-3 py-3 tabular-nums">{fmtCount(row.dardos_per_plant)}</td>
                          <td className="px-3 py-3 tabular-nums">{fmtCount(row.dardos_per_branch)}</td>
                          <td className="px-3 py-3 tabular-nums">{fmtCount(row.dardo_coral)}</td>
                          <td className="px-3 py-3">
                            <Badge variant="outline" className={COUNT_STYLE[countState]}>{countState}</Badge>
                          </td>
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
            <HarvestEstimationCharts
              totalKg={totals}
              byField={chartByField}
              byBlock={chartByBlock}
            />
          )}

          <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <p className="text-sm text-muted-foreground">
              Tabla detallada de estimaciones según los filtros seleccionados.
            </p>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button
                variant="outline"
                onClick={handleSyncEstimations}
                disabled={countSummaries.length === 0 || saving}
                className="gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                Calcular desde conteo
              </Button>
              <Button variant="outline" onClick={handleExportEstimation} className="gap-2" disabled={estimationDisplayRows.length === 0}>
                <Download className="w-4 h-4" /> Exportar Excel
              </Button>
              <Button variant="outline" onClick={() => openImportDialog('estimacion')} className="gap-2">
                <Upload className="w-4 h-4" /> Importar Excel
              </Button>
              <Button onClick={openCreateEstimation} className="gap-2">
                <Plus className="w-4 h-4" /> Nueva estimación
              </Button>
            </div>
          </div>

          {missingHaCount > 0 && countSummaries.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {missingHaCount} cuartel(es) sin hectáreas: completa la superficie en Cuarteles para calcular kg totales.
            </p>
          )}

          {estimationDisplayRows.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              <CalendarRange className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-foreground mb-1">Sin estimaciones en esta temporada</p>
              <p className="text-sm mb-4">
                Importa conteos, calcula desde promedios o crea una estimación manualmente.
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button variant="outline" onClick={() => openImportDialog('estimacion')} className="gap-2">
                  <Upload className="w-4 h-4" /> Importar Excel
                </Button>
                <Button variant="outline" onClick={() => setActiveTab('conteo')}>Ir a Conteo</Button>
                <Button onClick={openCreateEstimation}>Nueva estimación</Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1400px]">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-3 font-medium">Campo</th>
                      <th className="px-3 py-3 font-medium">Cuartel</th>
                      <th className="px-3 py-3 font-medium">Variedad</th>
                      <th className="px-3 py-3 font-medium">Ha</th>
                      <th className="px-3 py-3 font-medium">Pl/Ha</th>
                      <th className="px-3 py-3 font-medium">Dardos/pl</th>
                      <th className="px-3 py-3 font-medium">Dardos/ram</th>
                      <th className="px-3 py-3 font-medium">Prim/dardo</th>
                      <th className="px-3 py-3 font-medium">% Cuaja</th>
                      <th className="px-3 py-3 font-medium">Frutos/pl</th>
                      <th className="px-3 py-3 font-medium">Kg/pl</th>
                      <th className="px-3 py-3 font-medium">Kg/ha</th>
                      <th className="px-3 py-3 font-medium">Kg totales</th>
                      <th className="px-3 py-3 font-medium">Estado</th>
                      <th className="px-3 py-3 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {estimationDisplayRows.map((row) => {
                      const countState = (row.count_state ?? 'Pre-poda') as HarvestCountState
                      const canDelete = !row.id.startsWith('computed-')
                      return (
                      <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
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
                          <Badge variant="outline" className={COUNT_STYLE[countState]}>{countState}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditEstimation(row)} title="Editar estimación">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {canDelete && (
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(row)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog importar Excel */}
      <Dialog open={importDialogOpen} onOpenChange={(o) => { setImportDialogOpen(o); if (!o) setImportPreview(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {importMode === 'conteo' ? 'Importar conteo desde Excel' : 'Importar estimación desde Excel'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {importMode === 'conteo'
                ? 'Conteo fenológico: se importan todas las muestras por árbol. Los promedios (Hilera, Arbol, Dardo, Ramillas, Dardo Coral) se calculan por cuartel y variedad en columnas aparte.'
                : 'Solo estimación de cosecha: Excel con Kg/ha y Kg totales por cuartel (no uses aquí el Dashboard de conteo).'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file, importMode)
                e.target.value = ''
              }}
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Seleccionar archivo Excel
            </Button>
            {importPreview && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <p className="font-medium">Hoja: {importPreview.sheetName}</p>
                <p className="text-muted-foreground">
                  {importPreview.fields.length} campos · {importPreview.blocks.length} cuarteles · {importPreview.estimates.length} estimaciones
                </p>
                {importMode === 'conteo' && importPreview.source_row_count != null && (
                  <p className="text-xs text-muted-foreground">
                    {importPreview.estimates.length} muestras por árbol · promedio calculado al guardar por cuartel/variedad
                  </p>
                )}
                {importMode === 'conteo' && importPreview.estimates.every((e) => !e.hectares || e.hectares <= 0) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Sin hectáreas en el Excel. Tras importar, complétalas en Cuarteles para calcular kg totales.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Temporada detectada: {importPreview.season_label}</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                id="import-replace"
                checked={importReplace}
                onCheckedChange={(v) => setImportReplace(v === true)}
              />
              <Label htmlFor="import-replace" className="text-sm font-normal cursor-pointer">
                Reemplazar todos mis datos actuales antes de importar
              </Label>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={handleClearAllData}
              disabled={saving}
            >
              Vaciar todos mis datos (campos, cuarteles y estimaciones)
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmImport} disabled={!importPreview || importing}>
              {importing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog campos */}
      <Dialog open={fieldsDialogOpen} onOpenChange={setFieldsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mis campos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Registra los fundos o campos de tu operación. Luego podrás asignar cuarteles a cada uno.
            </p>
            <div className="flex gap-2">
              <Input
                value={fieldFormName}
                onChange={(e) => setFieldFormName(e.target.value)}
                placeholder="Nombre del campo"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveField()}
              />
              <Button onClick={handleSaveField} disabled={saving} className="shrink-0 gap-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Agregar
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
                    <Badge variant="secondary" className="text-[10px]">En cuarteles/estimaciones</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                Aún no tienes campos registrados.
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
                Eliminar todos los campos
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog cuarteles */}
      <Dialog open={blocksDialogOpen} onOpenChange={setBlocksDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mis cuarteles</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Campo *</label>
                {hasFieldOptions ? (
                  <Select
                    value={blockForm.field_name || 'none'}
                    onValueChange={(v) => setBlockForm({
                      ...blockForm,
                      field_name: v === 'none' ? '' : v,
                    })}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar campo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Seleccionar…</SelectItem>
                      {fieldOptions.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={blockForm.field_name}
                    onChange={(e) => setBlockForm({ ...blockForm, field_name: e.target.value })}
                    placeholder="Ej. Fundo Norte"
                  />
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Cuartel *</label>
                <Input
                  value={blockForm.block_name}
                  onChange={(e) => setBlockForm({ ...blockForm, block_name: e.target.value })}
                  placeholder="Ej. 1V"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Cultivo</label>
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
                <label className="text-xs text-muted-foreground">Variedad</label>
                <Select value={blockForm.variety} onValueChange={(v) => setBlockForm({ ...blockForm, variety: v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    {getVarietiesForCrop(blockForm.crop).map((v) => (
                      <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Hectáreas</label>
                <Input type="number" step="0.01" value={blockForm.hectares} onChange={(e) => setBlockForm({ ...blockForm, hectares: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Plantas/Ha</label>
                <Input type="number" value={blockForm.plants_per_ha} onChange={(e) => setBlockForm({ ...blockForm, plants_per_ha: e.target.value })} />
              </div>
            </div>
            {!hasFieldOptions && (
              <Button variant="link" className="h-auto p-0 text-xs" onClick={() => { setBlocksDialogOpen(false); setFieldsDialogOpen(true) }}>
                Primero agrega un campo
              </Button>
            )}
            <Button onClick={handleSaveBlock} disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Agregar cuartel
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
                Eliminar todos los cuarteles
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
                ? (editing ? 'Editar estimación de cosecha' : 'Nueva estimación de cosecha')
                : (editing ? 'Editar conteo' : 'Nuevo conteo fenológico')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {(dialogMode === 'conteo' || dialogMode === 'estimacion') && (
              <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Fecha *</label>
                <Input type="date" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Temporada</label>
                <Input value={form.season_label} onChange={(e) => setForm({ ...form, season_label: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Campo *</label>
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
                    <SelectTrigger><SelectValue placeholder="Seleccionar campo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Seleccionar…</SelectItem>
                      {fieldOptions.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.field_name}
                    onChange={(e) => setForm({ ...form, field_name: e.target.value })}
                    placeholder="Ej. Fundo Norte"
                  />
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Superficie (ha) *</label>
                <Input type="number" step="0.01" min="0" value={form.hectares} onChange={(e) => setForm({ ...form, hectares: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Cuartel *</label>
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
                    <SelectTrigger><SelectValue placeholder="Seleccionar cuartel" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Escribir manualmente…</SelectItem>
                      {blocksForSelectedField.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.block_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.block_name}
                    onChange={(e) => setForm({ ...form, block_name: e.target.value, block_id: '' })}
                    placeholder="Ej. 1V"
                  />
                )}
              </div>
              {(form.block_id === '' || blocksForSelectedField.length === 0) && (
                <div>
                  <label className="text-xs text-muted-foreground">Nombre cuartel</label>
                  <Input
                    value={form.block_name}
                    onChange={(e) => setForm({ ...form, block_name: e.target.value, block_id: '' })}
                    placeholder="Ej. 1V"
                  />
                </div>
              )}
            </div>
            {!hasFieldOptions && (
              <Button variant="link" className="h-auto p-0 text-xs justify-start" onClick={() => { setDialogOpen(false); setFieldsDialogOpen(true) }}>
                + Agregar campos a tu cuenta
              </Button>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Especie *</label>
                <Select value={form.crop} onValueChange={(v) => handleCropChange(v as HarvestCrop)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HARVEST_CROPS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Variedad *</label>
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
                  <label className="text-xs text-muted-foreground">Estado conteo</label>
                  <Select value={form.count_state} onValueChange={(v) => setForm({ ...form, count_state: v as HarvestCountState })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HARVEST_COUNT_STATES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {isCherry ? (
              <>
                <div className="rounded-lg border p-3 space-y-3">
                  <p className="text-xs font-medium text-foreground">
                    {dialogMode === 'estimacion' ? 'Parámetros de estimación' : 'Conteo fenológico'}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Plantas/Ha</label>
                      <Input type="number" value={form.plants_per_ha} onChange={(e) => setForm({ ...form, plants_per_ha: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Dardos/planta</label>
                      <Input type="number" step="0.1" value={form.dardos_per_plant} onChange={(e) => setForm({ ...form, dardos_per_plant: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Dardos/ramilla</label>
                      <Input type="number" step="0.1" value={form.dardos_per_branch} onChange={(e) => setForm({ ...form, dardos_per_branch: e.target.value })} />
                    </div>
                    {dialogMode === 'conteo' && (
                      <div>
                        <label className="text-xs text-muted-foreground">Dardo Coral</label>
                        <Input type="number" step="0.1" value={form.dardo_coral} onChange={(e) => setForm({ ...form, dardo_coral: e.target.value })} />
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-muted-foreground">% Cuaja</label>
                      <Input type="number" step="0.01" min="0" max="1" value={form.fruit_set_pct} onChange={(e) => setForm({ ...form, fruit_set_pct: e.target.value })} placeholder="0.20" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Primordios/dardo</label>
                      <Input type="number" step="0.01" value={form.primordia_per_dardo} onChange={(e) => setForm({ ...form, primordia_per_dardo: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Primordios/ramilla</label>
                      <Input type="number" step="0.01" value={form.primordia_per_branch} onChange={(e) => setForm({ ...form, primordia_per_branch: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Peso fruto (kg)</label>
                      <Input type="number" step="0.001" value={form.fruit_weight_kg} onChange={(e) => setForm({ ...form, fruit_weight_kg: e.target.value })} />
                    </div>
                  </div>
                </div>
                <ExcelCalcPanel form={form} />
              </>
            ) : (
              computedLive && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                  <p className="text-muted-foreground mb-1">{HARVEST_FORMULA_HINT[form.crop]}</p>
                  <p className="font-medium">Kg totales: {formatKg(computedLive.estimatedKg)}</p>
                </div>
              )
            )}

              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!canSaveDialog}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

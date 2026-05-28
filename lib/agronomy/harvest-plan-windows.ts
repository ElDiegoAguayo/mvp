import { DEFAULT_PHENOLOGY_STAGES } from '@/lib/agronomy/constants'
import { addDaysIso, fmtShortDate, type PhenologyStageRef } from '@/lib/agronomy/phenology-predictions'

export type HarvestWindowSource = 'manual' | 'phenology' | 'variety'

export interface HarvestPlanInput {
  id: string | null
  field_name: string | null
  block_name: string
  crop: string
  variety: string | null
  season_label: string
  estimated_kg: number
  expected_start: string | null
  expected_end: string | null
}

export interface PhenologyObsInput {
  block_name: string
  crop: string
  season_label: string
  stage_name: string
  stage_id: string | null
  observed_at: string
}

export interface HarvestPlanRow {
  id: string | null
  field_name: string
  block_name: string
  variety: string
  crop: string
  season_label: string
  estimated_kg: number
  window_start: string
  window_end: string
  source: HarvestWindowSource
  phenology_stage: string | null
  label: string
}

/** Ventana típica de cosecha por variedad de cerezo (Chile central). */
const CHERRY_VARIETY_WINDOWS: Record<string, { startMonth: number; startDay: number; endMonth: number; endDay: number }> = {
  Santina: { startMonth: 11, startDay: 8, endMonth: 11, endDay: 28 },
  Lapins: { startMonth: 11, startDay: 25, endMonth: 12, endDay: 22 },
  Regina: { startMonth: 11, startDay: 18, endMonth: 12, endDay: 10 },
  Kordia: { startMonth: 12, startDay: 1, endMonth: 12, endDay: 28 },
  'Sweet Heart': { startMonth: 12, startDay: 5, endMonth: 12, endDay: 30 },
  Bing: { startMonth: 11, startDay: 28, endMonth: 12, endDay: 18 },
}

const DEFAULT_CHERRY_WINDOW = { startMonth: 11, startDay: 15, endMonth: 12, endDay: 15 }
const HARVEST_WINDOW_DAYS = 14

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function seasonHarvestYear(seasonLabel: string): number {
  const parts = seasonLabel.trim().split('-')
  if (parts.length === 2) {
    const y = parseInt(parts[1]!, 10)
    if (Number.isFinite(y)) return y
  }
  return new Date().getFullYear()
}

function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function varietyWindow(crop: string, variety: string | null, seasonLabel: string): { start: string; end: string } {
  const year = seasonHarvestYear(seasonLabel)
  if (crop === 'Cerezo') {
    const key = variety?.trim() ?? ''
    const match = Object.entries(CHERRY_VARIETY_WINDOWS).find(
      ([name]) => name.toLowerCase() === key.toLowerCase(),
    )?.[1] ?? DEFAULT_CHERRY_WINDOW
    return {
      start: isoFromParts(year, match.startMonth, match.startDay),
      end: isoFromParts(year, match.endMonth, match.endDay),
    }
  }
  const start = isoFromParts(year, 3, 1)
  const end = isoFromParts(year, 5, 31)
  return { start, end }
}

function normalizeStageName(name: string): string {
  return name.trim().toLowerCase()
}

function isHarvestStage(name: string): boolean {
  const n = normalizeStageName(name)
  return n.includes('cosecha') || n.includes('maduración') || n.includes('maduracion') || n.includes('envero')
}

function resolveStages(crop: string, catalog: PhenologyStageRef[]): PhenologyStageRef[] {
  if (catalog.length > 0) {
    return [...catalog].sort((a, b) => a.sort_order - b.sort_order)
  }
  const defaults = DEFAULT_PHENOLOGY_STAGES[crop]
  if (!defaults) return []
  return defaults.map((s, i) => ({
    id: `default-${i}`,
    stage_name: s.stage_name,
    stage_code: s.stage_code,
    sort_order: s.sort_order,
    typical_days: s.typical_days,
  }))
}

function daysFromStageToHarvest(
  stageName: string,
  stageId: string | null,
  stages: PhenologyStageRef[],
): number | null {
  if (stages.length === 0) return null

  let currentIdx = stageId ? stages.findIndex((s) => s.id === stageId) : -1
  if (currentIdx < 0) {
    const normalized = normalizeStageName(stageName)
    currentIdx = stages.findIndex((s) => normalizeStageName(s.stage_name) === normalized)
  }
  if (currentIdx < 0) {
    currentIdx = stages.findIndex((s) => {
      const n = normalizeStageName(s.stage_name)
      return normalizedStageIncludes(normalizeStageName(stageName), n) || normalizedStageIncludes(n, normalizeStageName(stageName))
    })
  }
  if (currentIdx < 0) return null

  if (isHarvestStage(stages[currentIdx]!.stage_name)) return 0

  let harvestIdx = stages.findIndex((s) => isHarvestStage(s.stage_name))
  if (harvestIdx < 0) harvestIdx = stages.length - 1
  if (harvestIdx <= currentIdx) return HARVEST_WINDOW_DAYS

  let total = 0
  for (let i = currentIdx + 1; i <= harvestIdx; i++) {
    const days = stages[i]?.typical_days
    if (days != null && days > 0) total += days
  }
  return total > 0 ? total : null
}

function normalizedStageIncludes(a: string, b: string): boolean {
  return a.includes(b) || b.includes(a)
}

function phenologyWindow(
  obs: PhenologyObsInput,
  stages: PhenologyStageRef[],
): { start: string; end: string } | null {
  const days = daysFromStageToHarvest(obs.stage_name, obs.stage_id, stages)
  if (days == null) return null
  const start = addDaysIso(obs.observed_at, days)
  const end = addDaysIso(start, HARVEST_WINDOW_DAYS - 1)
  return { start, end }
}

export function buildHarvestPlanRows(
  estimates: HarvestPlanInput[],
  observations: PhenologyObsInput[],
  stagesByCrop: Map<string, PhenologyStageRef[]>,
): HarvestPlanRow[] {
  const obsByBlock = new Map<string, PhenologyObsInput[]>()
  for (const obs of observations) {
    const key = `${obs.season_label}::${obs.block_name}`
    const list = obsByBlock.get(key) ?? []
    list.push(obs)
    obsByBlock.set(key, list)
  }

  return estimates
    .filter((e) => Number(e.estimated_kg) > 0)
    .map((est) => {
      const variety = est.variety?.trim() || est.crop
      const field = est.field_name?.trim() || '—'
      const label = `${field} · ${est.block_name} · ${variety}`

      if (est.expected_start && est.expected_end) {
        return {
          id: est.id,
          field_name: field,
          block_name: est.block_name,
          variety,
          crop: est.crop,
          season_label: est.season_label,
          estimated_kg: Number(est.estimated_kg),
          window_start: est.expected_start,
          window_end: est.expected_end,
          source: 'manual' as const,
          phenology_stage: null,
          label,
        }
      }

      const obsKey = `${est.season_label}::${est.block_name}`
      const blockObs = (obsByBlock.get(obsKey) ?? [])
        .filter((o) => o.crop === est.crop)
        .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
      const latestObs = blockObs[0]
      const stages = resolveStages(est.crop, stagesByCrop.get(est.crop) ?? [])

      if (latestObs) {
        const inferred = phenologyWindow(latestObs, stages)
        if (inferred) {
          return {
            id: est.id,
            field_name: field,
            block_name: est.block_name,
            variety,
            crop: est.crop,
            season_label: est.season_label,
            estimated_kg: Number(est.estimated_kg),
            window_start: inferred.start,
            window_end: inferred.end,
            source: 'phenology' as const,
            phenology_stage: latestObs.stage_name,
            label,
          }
        }
      }

      const fallback = varietyWindow(est.crop, est.variety, est.season_label)
      return {
        id: est.id,
        field_name: field,
        block_name: est.block_name,
        variety,
        crop: est.crop,
        season_label: est.season_label,
        estimated_kg: Number(est.estimated_kg),
        window_start: fallback.start,
        window_end: fallback.end,
        source: 'variety' as const,
        phenology_stage: latestObs?.stage_name ?? null,
        label,
      }
    })
    .sort((a, b) =>
      a.window_start.localeCompare(b.window_start)
      || a.field_name.localeCompare(b.field_name, 'es')
      || a.block_name.localeCompare(b.block_name, 'es'),
    )
}

export function computeTimelineRange(rows: HarvestPlanRow[], paddingDays = 7): { start: string; end: string } | null {
  if (rows.length === 0) return null
  let min = rows[0]!.window_start
  let max = rows[0]!.window_end
  for (const row of rows) {
    if (row.window_start < min) min = row.window_start
    if (row.window_end > max) max = row.window_end
  }
  return { start: addDaysIso(min, -paddingDays), end: addDaysIso(max, paddingDays) }
}

export function daysBetween(startIso: string, endIso: string): number {
  const a = new Date(startIso + 'T12:00:00').getTime()
  const b = new Date(endIso + 'T12:00:00').getTime()
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1)
}

export function barPosition(
  windowStart: string,
  windowEnd: string,
  rangeStart: string,
  rangeEnd: string,
): { leftPct: number; widthPct: number } {
  const rangeDays = daysBetween(rangeStart, rangeEnd)
  const startOffset = daysBetween(rangeStart, windowStart) - 1
  const barDays = daysBetween(windowStart, windowEnd)
  const leftPct = Math.max(0, Math.min(100, (startOffset / rangeDays) * 100))
  const widthPct = Math.max(2, Math.min(100 - leftPct, (barDays / rangeDays) * 100))
  return { leftPct, widthPct }
}

export function formatWindowRange(start: string, end: string): string {
  return `${fmtShortDate(start)} – ${fmtShortDate(end)}`
}

export const WINDOW_SOURCE_LABELS: Record<HarvestWindowSource, string> = {
  manual: 'Fechas guardadas',
  phenology: 'Desde fenología',
  variety: 'Referencia variedad',
}

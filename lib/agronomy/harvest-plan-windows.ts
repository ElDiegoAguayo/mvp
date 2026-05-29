import { addDaysIso, fmtShortDate } from '@/lib/agronomy/phenology-predictions'

export type HarvestWindowSource = 'manual' | 'count' | 'variety'

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

export interface CountRecordInput {
  field_name: string | null
  block_name: string
  crop: string
  season_label: string
  record_date: string | null
  count_state?: string | null
  hilera?: number | null
  arbol?: number | null
  is_count_summary?: boolean | null
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
  count_label: string | null
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

function normalizeField(field: string | null | undefined): string {
  return (field ?? '').trim()
}

function blockCountKey(season: string, field: string, block: string, crop: string): string {
  return `${season}::${field}::${block}::${crop}`
}

export function isCountSampleRow(row: CountRecordInput): boolean {
  return row.hilera != null || row.arbol != null || row.is_count_summary === false
}

function isoDateOnly(value: string | null | undefined): string | null {
  if (!value || value.length < 10) return null
  return value.slice(0, 10)
}

function isPreCountState(state: string | null | undefined): boolean {
  const n = (state ?? 'Pre-poda').trim().toLowerCase()
  return n.includes('pre')
}

function isPostCountState(state: string | null | undefined): boolean {
  return (state ?? '').trim().toLowerCase().includes('post')
}

/** Inicio = primera fecha de conteo; fin = última (Pre-poda → Post-poda si existen ambos). */
export function countWindowForBlock(records: CountRecordInput[]): { start: string; end: string; label: string } | null {
  const dated = records
    .map((r) => ({ ...r, date: isoDateOnly(r.record_date) }))
    .filter((r): r is CountRecordInput & { date: string } => r.date != null)

  if (dated.length === 0) return null

  const preDates = dated.filter((r) => isPreCountState(r.count_state)).map((r) => r.date).sort()
  const postDates = dated.filter((r) => isPostCountState(r.count_state)).map((r) => r.date).sort()
  const allDates = dated.map((r) => r.date).sort()

  if (preDates.length > 0 && postDates.length > 0) {
    return {
      start: preDates[0]!,
      end: postDates[postDates.length - 1]!,
      label: 'Conteo Pre-poda → Post-poda',
    }
  }

  const sampleCount = dated.filter(isCountSampleRow).length
  const label = sampleCount > 0
    ? `${sampleCount} muestra${sampleCount === 1 ? '' : 's'} de conteo`
    : `${dated.length} registro${dated.length === 1 ? '' : 's'} de conteo`

  return {
    start: allDates[0]!,
    end: allDates[allDates.length - 1]!,
    label,
  }
}

export function buildHarvestPlanRows(
  estimates: HarvestPlanInput[],
  countRecords: CountRecordInput[],
): HarvestPlanRow[] {
  const countsByBlock = new Map<string, CountRecordInput[]>()
  for (const row of countRecords) {
    if (!isCountSampleRow(row) && !row.record_date) continue
    const key = blockCountKey(
      row.season_label,
      normalizeField(row.field_name),
      row.block_name,
      row.crop,
    )
    const list = countsByBlock.get(key) ?? []
    list.push(row)
    countsByBlock.set(key, list)
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
          count_label: null,
          label,
        }
      }

      const countKey = blockCountKey(
        est.season_label,
        normalizeField(est.field_name),
        est.block_name,
        est.crop,
      )
      const blockCounts = countsByBlock.get(countKey) ?? []
      const fromCount = countWindowForBlock(blockCounts)

      if (fromCount) {
        return {
          id: est.id,
          field_name: field,
          block_name: est.block_name,
          variety,
          crop: est.crop,
          season_label: est.season_label,
          estimated_kg: Number(est.estimated_kg),
          window_start: fromCount.start,
          window_end: fromCount.end,
          source: 'count' as const,
          count_label: fromCount.label,
          label,
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
        count_label: null,
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
  count: 'Desde conteo',
  variety: 'Referencia variedad',
}

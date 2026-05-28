import type { ParsedHarvestEstimate } from './parse-harvest-xlsx'
import { calculateCherryHarvest } from './cherry-harvest-formula'

const NUMERIC_COUNT_FIELDS = [
  'hectares',
  'plants_per_ha',
  'dardos_per_plant',
  'dardos_per_branch',
  'dardo_coral',
  'primordia_per_dardo',
  'primordia_per_branch',
  'fruit_set_pct',
  'fruits_set',
  'fruit_weight_kg',
] as const

type NumericCountField = (typeof NUMERIC_COUNT_FIELDS)[number]

function groupKey(row: ParsedHarvestEstimate): string {
  return [
    row.field_name,
    row.block_name,
    row.variety || '',
    row.count_state ?? 'Pre-poda',
    row.season_label,
  ].join('::')
}

function average(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(Number(v)))
  if (nums.length === 0) return null
  return nums.reduce((sum, n) => sum + Number(n), 0) / nums.length
}

function firstNonEmpty<T>(values: T[], predicate: (v: T) => boolean): T | undefined {
  return values.find(predicate)
}

function computeKgFromCount(
  row: ParsedHarvestEstimate,
): Pick<ParsedHarvestEstimate, 'fruits_set' | 'kg_per_plant' | 'kg_per_ha' | 'estimated_kg'> {
  const plants = row.plants_per_ha
  const hectares = row.hectares
  if (
    plants == null
    || hectares == null
    || hectares <= 0
    || row.dardos_per_plant == null
    || row.primordia_per_dardo == null
    || row.fruit_set_pct == null
    || row.fruit_weight_kg == null
  ) {
    return {
      fruits_set: row.fruits_set,
      kg_per_plant: row.kg_per_plant,
      kg_per_ha: row.kg_per_ha,
      estimated_kg: row.estimated_kg ?? 0,
    }
  }

  const result = calculateCherryHarvest({
    plantsPerHa: plants,
    dardosPerPlant: row.dardos_per_plant,
    dardosPerBranch: row.dardos_per_branch ?? 0,
    primordiaPerDardo: row.primordia_per_dardo,
    primordiaPerBranch: row.primordia_per_branch ?? 0,
    fruitSetPct: row.fruit_set_pct,
    fruitWeightKg: row.fruit_weight_kg,
    hectares,
  })

  return {
    fruits_set: row.fruits_set ?? result.fruitsSet,
    kg_per_plant: result.kgPerPlant,
    kg_per_ha: result.kgPerHa,
    estimated_kg: result.kgTotal,
  }
}

/** Promedia filas de conteo por campo + cuartel + variedad (+ estado y temporada). */
export function aggregateCountByBlockVariety(
  rows: ParsedHarvestEstimate[],
): ParsedHarvestEstimate[] {
  const groups = new Map<string, ParsedHarvestEstimate[]>()

  for (const row of rows) {
    const key = groupKey(row)
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }

  const aggregated: ParsedHarvestEstimate[] = []

  for (const group of groups.values()) {
    const template = group[0]
    const merged: ParsedHarvestEstimate = {
      ...template,
      crop: firstNonEmpty(group.map((r) => r.crop), (v) => !!v.trim())?.crop || template.crop || 'Cerezo',
      variety: firstNonEmpty(group.map((r) => r.variety), (v) => !!v.trim())?.variety || template.variety,
      count_state: template.count_state ?? 'Pre-poda',
      plants_per_ha: null,
      dardos_per_plant: null,
      dardos_per_branch: null,
      dardo_coral: null,
      count_sample_count: group.length,
      primordia_per_dardo: null,
      primordia_per_branch: null,
      fruit_set_pct: null,
      fruits_set: null,
      fruit_weight_kg: null,
      kg_per_plant: null,
      kg_per_ha: null,
      estimated_kg: 0,
    }

    for (const field of NUMERIC_COUNT_FIELDS) {
      const avg = average(group.map((r) => r[field as NumericCountField]))
      if (avg != null) {
        ;(merged as Record<string, unknown>)[field] = avg
      }
    }

    if (merged.hectares == null) merged.hectares = 0

    const hasCountMetrics = [
      merged.dardos_per_plant,
      merged.dardos_per_branch,
      merged.dardo_coral,
      merged.primordia_per_dardo,
      merged.primordia_per_branch,
      merged.fruit_set_pct,
      merged.fruits_set,
    ].some((v) => v != null)

    if (!hasCountMetrics) continue

    aggregated.push({
      ...merged,
      ...computeKgFromCount(merged),
    })
  }

  return aggregated
}

export { computeKgFromCount }

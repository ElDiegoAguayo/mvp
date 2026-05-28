import { computeKgFromCount } from './aggregate-count-rows'
import { getCherryVarietyDefaults } from './cherry-harvest-formula'
import type { CountGroupSummary } from './count-group-averages'
import type { ParsedHarvestBlock, ParsedHarvestEstimate } from './parse-harvest-xlsx'

export function enrichAggregatedEstimateForEstimation(
  aggregated: ParsedHarvestEstimate,
  block?: ParsedHarvestBlock | null,
): ParsedHarvestEstimate {
  const defaults = getCherryVarietyDefaults(aggregated.variety)
  const hectares = block?.hectares && block.hectares > 0
    ? block.hectares
    : (aggregated.hectares > 0 ? aggregated.hectares : 0)

  const enriched: ParsedHarvestEstimate = {
    ...aggregated,
    crop: aggregated.crop || block?.crop || 'Cerezo',
    hectares,
    plants_per_ha: block?.plants_per_ha ?? aggregated.plants_per_ha ?? defaults.plantsPerHa,
    dardos_per_plant: aggregated.dardos_per_plant,
    dardos_per_branch: aggregated.dardos_per_branch ?? 0,
    primordia_per_dardo: aggregated.primordia_per_dardo ?? defaults.primordiaPerDardo,
    primordia_per_branch: aggregated.primordia_per_branch ?? defaults.primordiaPerBranch,
    fruit_set_pct: aggregated.fruit_set_pct ?? defaults.fruitSetPct,
    fruit_weight_kg: aggregated.fruit_weight_kg ?? defaults.fruitWeightKg,
    is_count_summary: true,
  }

  return { ...enriched, ...computeKgFromCount(enriched) }
}

export function buildEstimationFromCountSummary(
  summary: CountGroupSummary,
  options: {
    season_label: string
    block?: ParsedHarvestBlock | null
    crop?: string
  },
): ParsedHarvestEstimate {
  const aggregated: ParsedHarvestEstimate = {
    field_name: summary.field_name,
    block_name: summary.block_name,
    crop: options.crop ?? options.block?.crop ?? 'Cerezo',
    variety: summary.variety,
    season_label: options.season_label,
    hectares: 0,
    plants_per_ha: null,
    hilera: null,
    arbol: null,
    is_count_summary: true,
    dardos_per_plant: summary.dardos_per_plant,
    dardos_per_branch: summary.dardos_per_branch,
    dardo_coral: summary.dardo_coral,
    count_sample_count: summary.sample_count,
    primordia_per_dardo: null,
    primordia_per_branch: null,
    fruit_set_pct: null,
    fruits_set: null,
    fruit_weight_kg: null,
    kg_per_plant: null,
    kg_per_ha: null,
    estimated_kg: 0,
    count_state: (summary.count_state === 'Post-poda' ? 'Post-poda' : 'Pre-poda'),
  }

  return enrichAggregatedEstimateForEstimation(aggregated, options.block)
}

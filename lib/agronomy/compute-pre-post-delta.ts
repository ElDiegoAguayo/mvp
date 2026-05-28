import { listCountGroupSummaries, countGroupKey } from '@/lib/agronomy/count-group-averages'
import { buildEstimationFromCountSummary } from '@/lib/agronomy/build-estimation-from-count'
import { buildPrePostDeltaRows, type PrePostDeltaRow } from '@/lib/agronomy/harvest-pre-post-delta'

interface HarvestBlockRef {
  field_name: string
  block_name: string
  crop: string
  variety: string | null
  hectares: number | null
  plants_per_ha: number | null
}

interface HarvestEstimateRef {
  field_name: string | null
  block_name: string
  crop: string
  variety: string | null
  season_label: string
  count_state: string | null
  is_count_summary: boolean | null
  hilera: number | null
  arbol: number | null
  hectares: number | null
  plants_per_ha: number | null
  dardos_per_plant: number | null
  dardos_per_branch: number | null
  dardo_coral: number | null
  count_sample_count: number | null
  estimated_kg: number
}

export function computePrePostDeltaRows(
  rows: HarvestEstimateRef[],
  blocks: HarvestBlockRef[],
  season: string,
  filters: {
    field: string
    crop: string
    variety: string
    block: string
  },
): PrePostDeltaRow[] {
  const base = rows.filter((r) => {
    if (r.season_label !== season) return false
    if (filters.field !== 'all' && (r.field_name ?? '') !== filters.field) return false
    if (filters.crop !== 'all' && r.crop !== filters.crop) return false
    const variety = r.variety?.trim() || r.crop
    if (filters.variety !== 'all' && variety !== filters.variety) return false
    if (filters.block !== 'all' && r.block_name !== filters.block) return false
    return true
  })

  const countRows = base.filter(
    (r) => r.hilera != null || r.arbol != null || r.is_count_summary === false,
  )
  const estimationRows = base.filter(
    (r) => r.is_count_summary === true || (r.is_count_summary == null && r.hilera == null && r.arbol == null),
  )

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

  const summaries = [...fromSamples, ...fromManual]
  const kgRows = summaries.map((summary) => {
    const block = blocks.find(
      (b) => b.field_name === summary.field_name && b.block_name === summary.block_name,
    )
    const existing = estimationRows.find((r) => countGroupKey(r) === countGroupKey(summary))
    const hectares = (existing?.hectares != null && existing.hectares > 0)
      ? existing.hectares
      : (block?.hectares != null && block.hectares > 0 ? block.hectares : 0)
    const built = buildEstimationFromCountSummary(summary, {
      season_label: season,
      block: block
        ? { ...block, hectares, plants_per_ha: block.plants_per_ha ?? existing?.plants_per_ha ?? null }
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
      field_name: built.field_name,
      block_name: built.block_name,
      variety: built.variety || summary.variety,
      crop: built.crop,
      count_state: built.count_state,
      estimated_kg: built.estimated_kg,
    }
  })

  return buildPrePostDeltaRows(kgRows)
}

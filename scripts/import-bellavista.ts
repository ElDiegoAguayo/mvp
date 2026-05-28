import * as fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { parseCountWorkbook } from '../lib/agronomy/parse-count-xlsx'
import { aggregateCountByBlockVariety } from '../lib/agronomy/aggregate-count-rows'
import { enrichAggregatedEstimateForEstimation } from '../lib/agronomy/build-estimation-from-count'

async function main() {
  const xlsxPath = process.argv[2] ?? 'c:/Users/diego/Downloads/Dashboard Agricola Bellavista_ (2).xlsx'
  const ownerId = process.argv[3]

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan variables SUPABASE en .env.local')
  if (!ownerId) throw new Error('Uso: tsx scripts/import-bellavista.ts <xlsx> <user_id>')

  const buffer = fs.readFileSync(xlsxPath).buffer
  const data = parseCountWorkbook(buffer)
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const date = new Date().toISOString().slice(0, 10)

  if (data.fields.length > 0) {
    await sb.from('harvest_fields').upsert(
      data.fields.map((name) => ({ user_id: ownerId, name })),
      { onConflict: 'user_id,name', ignoreDuplicates: true },
    )
  }

  if (data.blocks.length > 0) {
    await sb.from('harvest_blocks').upsert(
      data.blocks.map((b) => ({
        user_id: ownerId,
        field_name: b.field_name,
        block_name: b.block_name,
        crop: b.crop,
        variety: b.variety,
        hectares: b.hectares,
        plants_per_ha: b.plants_per_ha,
      })),
      { onConflict: 'user_id,field_name,block_name' },
    )
  }

  const sampleRows = data.estimates.map((e) => ({
    user_id: ownerId,
    field_name: e.field_name,
    block_name: e.block_name,
    crop: e.crop.trim(),
    variety: e.variety || null,
    season_label: e.season_label,
    record_date: date,
    hectares: e.hectares > 0 ? e.hectares : null,
    plants_per_ha: e.plants_per_ha,
    hilera: e.hilera,
    arbol: e.arbol,
    is_count_summary: false,
    dardos_per_plant: e.dardos_per_plant,
    dardos_per_branch: e.dardos_per_branch,
    dardo_coral: e.dardo_coral,
    primordia_per_dardo: e.primordia_per_dardo,
    primordia_per_branch: e.primordia_per_branch,
    fruit_set_pct: e.fruit_set_pct,
    fruits_set: e.fruits_set,
    fruit_weight_kg: e.fruit_weight_kg,
    estimated_kg: 0,
    harvested_kg: 0,
    count_state: e.count_state,
    status: 'planificado',
  }))

  const { error: sampleError } = await sb.from('harvest_estimates').insert(sampleRows)
  if (sampleError) throw sampleError

  const summaryRows = aggregateCountByBlockVariety(data.estimates).map((e) => {
    const block = data.blocks.find(
      (b) => b.field_name === e.field_name && b.block_name === e.block_name,
    )
    const enriched = enrichAggregatedEstimateForEstimation(e, block)
    return {
      user_id: ownerId,
      field_name: e.field_name,
      block_name: e.block_name,
      crop: e.crop.trim(),
      variety: e.variety || null,
      season_label: e.season_label,
      record_date: date,
      hectares: e.hectares > 0 ? e.hectares : null,
      plants_per_ha: e.plants_per_ha,
      is_count_summary: true,
      dardos_per_plant: e.dardos_per_plant,
      dardos_per_branch: e.dardos_per_branch,
      dardo_coral: e.dardo_coral,
      count_sample_count: e.count_sample_count ?? null,
      primordia_per_dardo: e.primordia_per_dardo,
      primordia_per_branch: e.primordia_per_branch,
      fruit_set_pct: e.fruit_set_pct,
      fruits_set: enriched.fruits_set,
      fruit_weight_kg: enriched.fruit_weight_kg,
      kg_per_plant: enriched.kg_per_plant,
      kg_per_ha: enriched.kg_per_ha,
      estimated_kg: enriched.estimated_kg,
      harvested_kg: 0,
      count_state: e.count_state,
      status: 'planificado',
    }
  })

  const { error: summaryError } = await sb.from('harvest_estimates').insert(summaryRows)
  if (summaryError) throw summaryError

  console.log('Import OK:', {
    fields: data.fields.length,
    blocks: data.blocks.length,
    samples: data.estimates.length,
    summaries: summaryRows.length,
    season: data.season_label,
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

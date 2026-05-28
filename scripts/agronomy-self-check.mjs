function phenologyObservationKey(row) {
  return [
    row.crop,
    row.block_name.trim().toLowerCase(),
    row.season_label.trim().toLowerCase(),
    row.observed_at,
    (row.variety ?? '').trim().toLowerCase(),
  ].join('|')
}

function resolveStageFromCatalog(stageName, stages) {
  const trimmed = stageName.trim()
  const normalized = trimmed.toLowerCase()
  if (!normalized) return { stage_id: null, stage_name: trimmed, catalogMatch: false }
  const exact = stages.find((s) => s.stage_name.trim().toLowerCase() === normalized)
  if (exact) return { stage_id: exact.id, stage_name: exact.stage_name, catalogMatch: true }
  return { stage_id: null, stage_name: trimmed, catalogMatch: false }
}

function buildPrePostDeltaRows(rows) {
  const map = new Map()
  for (const row of rows) {
    const variety = row.variety?.trim() || row.crop || '—'
    const key = `${row.field_name ?? ''}::${row.block_name}::${variety}`
    const label = `${row.block_name} · ${variety}`
    const entry = map.get(key) ?? {
      field_name: row.field_name ?? '',
      block_name: row.block_name,
      variety,
      label,
      preKg: 0,
      postKg: 0,
      deltaPct: null,
    }
    if (row.count_state === 'Post-poda') {
      entry.postKg += Number(row.estimated_kg) || 0
    } else {
      entry.preKg += Number(row.estimated_kg) || 0
    }
    map.set(key, entry)
  }
  return [...map.values()]
    .filter((e) => e.preKg > 0 || e.postKg > 0)
    .map((e) => ({
      ...e,
      deltaPct: e.preKg > 0 ? Math.round(((e.postKg - e.preKg) / e.preKg) * 100) : null,
    }))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const key = phenologyObservationKey({
  crop: 'Arándano',
  block_name: 'C1',
  season_label: '2025-2026',
  observed_at: '2026-01-15',
  variety: 'Legacy',
})
assert(key.includes('c1'), 'key normalizes block name')

const resolved = resolveStageFromCatalog('Floración', [
  { id: '1', stage_name: 'Floración', stage_code: 'F1' },
])
assert(resolved.catalogMatch === true, 'catalog match by name')

const delta = buildPrePostDeltaRows([
  { field_name: 'F1', block_name: '3V', variety: 'Santina', crop: 'Cerezo', count_state: 'Pre-poda', estimated_kg: 10000 },
  { field_name: 'F1', block_name: '3V', variety: 'Santina', crop: 'Cerezo', count_state: 'Post-poda', estimated_kg: 12000 },
])
assert(delta[0]?.deltaPct === 20, 'pre/post delta percent')

console.log('agronomy self-check ok')

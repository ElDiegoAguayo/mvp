export interface PrePostDeltaRow {
  field_name: string
  block_name: string
  variety: string
  label: string
  preKg: number
  postKg: number
  deltaPct: number | null
}

export function buildPrePostDeltaRows(
  rows: Array<{
    field_name?: string | null
    block_name: string
    variety?: string | null
    crop?: string
    count_state?: string | null
    estimated_kg: number
  }>,
): PrePostDeltaRow[] {
  const map = new Map<string, PrePostDeltaRow>()

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
    .sort((a, b) => b.postKg - a.postKg || b.preKg - a.preKg)
}

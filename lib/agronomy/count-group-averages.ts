export interface CountGroupAverage {
  hilera: number | null
  arbol: number | null
  dardos_per_plant: number | null
  dardos_per_branch: number | null
  dardo_coral: number | null
  sample_count: number
}

export interface CountGroupRow {
  field_name: string | null
  block_name: string
  variety: string | null
  count_state?: string | null
  hilera?: number | null
  arbol?: number | null
  dardos_per_plant?: number | null
  dardos_per_branch?: number | null
  dardo_coral?: number | null
}

export function countGroupKey(row: CountGroupRow): string {
  return [
    row.field_name ?? '',
    row.block_name,
    row.variety ?? '',
    row.count_state ?? 'Pre-poda',
  ].join('::')
}

function average(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(Number(v)))
  if (nums.length === 0) return null
  return nums.reduce((sum, n) => sum + Number(n), 0) / nums.length
}

export function buildCountGroupAverages(rows: CountGroupRow[]): Map<string, CountGroupAverage> {
  const groups = new Map<string, CountGroupRow[]>()

  for (const row of rows) {
    const key = countGroupKey(row)
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }

  const result = new Map<string, CountGroupAverage>()
  for (const [key, group] of groups) {
    result.set(key, {
      hilera: average(group.map((r) => r.hilera)),
      arbol: average(group.map((r) => r.arbol)),
      dardos_per_plant: average(group.map((r) => r.dardos_per_plant)),
      dardos_per_branch: average(group.map((r) => r.dardos_per_branch)),
      dardo_coral: average(group.map((r) => r.dardo_coral)),
      sample_count: group.length,
    })
  }

  return result
}

export function fmtCountAvg(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return (Math.round(Number(v) * 100) / 100).toLocaleString('es-CL', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })
}

export interface CountGroupSummary extends CountGroupAverage {
  field_name: string
  block_name: string
  variety: string
  count_state: string
}

export function listCountGroupSummaries(rows: CountGroupRow[]): CountGroupSummary[] {
  const groups = new Map<string, CountGroupRow[]>()

  for (const row of rows) {
    const key = countGroupKey(row)
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }

  const summaries: CountGroupSummary[] = []
  for (const group of groups.values()) {
    const template = group[0]
    summaries.push({
      field_name: template.field_name ?? '',
      block_name: template.block_name,
      variety: template.variety ?? '',
      count_state: template.count_state ?? 'Pre-poda',
      hilera: average(group.map((r) => r.hilera)),
      arbol: average(group.map((r) => r.arbol)),
      dardos_per_plant: average(group.map((r) => r.dardos_per_plant)),
      dardos_per_branch: average(group.map((r) => r.dardos_per_branch)),
      dardo_coral: average(group.map((r) => r.dardo_coral)),
      sample_count: group.length,
    })
  }

  return summaries.sort((a, b) =>
    a.field_name.localeCompare(b.field_name, 'es')
    || a.block_name.localeCompare(b.block_name, 'es')
    || a.variety.localeCompare(b.variety, 'es'),
  )
}

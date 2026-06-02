import type { PhytoStockRow } from '@/lib/fitosanitario/types'

export interface ScheduleRow {
  item_id: string
  application_date: string | null
  application_end_date: string | null
  sort_order: number
  product_id: string | null
  product_name: string
  unit: string
  qty: number
  stock_before: number
  stock_after: number
  sufficient: boolean
  stage_label: string
  field_name: string
  target_label: string
}

export interface StockTimelinePoint {
  date: string
  label: string
  product_name: string
  stock_remaining: number
}

function productKey(productId: string | null, productName: string): string {
  return productId ?? `name:${productName.trim().toLowerCase()}`
}

export function buildStockPool(stockRows: PhytoStockRow[]): Map<string, number> {
  const pool = new Map<string, number>()
  for (const row of stockRows) {
    const key = productKey(row.product_id, row.product_name)
    pool.set(key, (pool.get(key) ?? 0) + row.stock)
  }
  return pool
}

export function computeProgressiveSchedule(input: {
  items: Array<{
    id: string
    application_date: string | null
    application_end_date?: string | null
    sort_order: number
    product_id: string | null
    product_name: string
    unit: string
    total_required: number | null
    total_applied: number | null
    status: string
    stage_label: string
    field_name: string
    target_label: string
  }>
  stockRows: PhytoStockRow[]
  startDate?: string | null
  endDate?: string | null
}): ScheduleRow[] {
  const pool = buildStockPool(input.stockRows)

  const sorted = input.items
    .filter(i => i.status !== 'cancelled')
    .filter(i => {
      if (!input.startDate && !input.endDate) return true
      if (!i.application_date) return true
      if (input.startDate && i.application_date < input.startDate) return false
      if (input.endDate && i.application_date > input.endDate) return false
      return true
    })
    .sort((a, b) => {
      const da = a.application_date ?? '9999-12-31'
      const db = b.application_date ?? '9999-12-31'
      if (da !== db) return da.localeCompare(db)
      return a.sort_order - b.sort_order
    })

  const rows: ScheduleRow[] = []
  for (const item of sorted) {
    const key = productKey(item.product_id, item.product_name)
    const qty = Number(item.total_required) || Number(item.total_applied) || 0
    const before = pool.get(key) ?? 0
    const after = before - qty
    pool.set(key, after)
    rows.push({
      item_id: item.id,
      application_date: item.application_date,
      application_end_date: item.application_end_date ?? null,
      sort_order: item.sort_order,
      product_id: item.product_id,
      product_name: item.product_name,
      unit: item.unit,
      qty,
      stock_before: before,
      stock_after: after,
      sufficient: after >= 0,
      stage_label: item.stage_label,
      field_name: item.field_name,
      target_label: item.target_label,
    })
  }
  return rows
}

export function buildStockTimeline(schedule: ScheduleRow[]): StockTimelinePoint[] {
  return schedule
    .filter(r => r.application_date && r.qty > 0)
    .map(r => ({
      date: r.application_date!,
      label: r.application_date!,
      product_name: r.product_name,
      stock_remaining: r.stock_after,
    }))
}

export function inferProgramDateRange(items: Array<{ application_date: string | null }>): {
  start_date: string | null
  end_date: string | null
} {
  const dates = items
    .map(i => i.application_date)
    .filter((d): d is string => Boolean(d))
    .sort()
  if (!dates.length) return { start_date: null, end_date: null }
  return { start_date: dates[0], end_date: dates[dates.length - 1] }
}

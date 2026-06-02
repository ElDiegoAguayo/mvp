import type { PhytoMovement, PhytoMovementType, PhytoProduct, PhytoStockRow, PhytoWarehouse } from '@/lib/fitosanitario/types'

export function movementDelta(type: PhytoMovementType, quantity: number): number {
  return type === 'salida' ? -quantity : quantity
}

export function computeStockFromMovements(
  movements: Array<Pick<PhytoMovement, 'warehouse_id' | 'product_id' | 'type' | 'quantity'>>,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const m of movements) {
    const key = `${m.warehouse_id}:${m.product_id}`
    map.set(key, (map.get(key) ?? 0) + movementDelta(m.type, m.quantity))
  }
  return map
}

export function computeEntriesExits(
  movements: Array<Pick<PhytoMovement, 'warehouse_id' | 'product_id' | 'type' | 'quantity'>>,
): Map<string, { entries: number; exits: number }> {
  const map = new Map<string, { entries: number; exits: number }>()
  for (const m of movements) {
    const key = `${m.warehouse_id}:${m.product_id}`
    const prev = map.get(key) ?? { entries: 0, exits: 0 }
    if (m.type === 'entrada' || m.type === 'ajuste') prev.entries += m.quantity
    if (m.type === 'salida') prev.exits += m.quantity
    map.set(key, prev)
  }
  return map
}

export function buildStockRows(input: {
  warehouses: PhytoWarehouse[]
  products: PhytoProduct[]
  movements: PhytoMovement[]
}): PhytoStockRow[] {
  const stockMap = computeStockFromMovements(input.movements)
  const flowMap = computeEntriesExits(input.movements)
  const lastDate = new Map<string, string>()
  const fieldByKey = new Map<string, string>()
  const monthByKey = new Map<string, string>()

  for (const m of input.movements) {
    const key = `${m.warehouse_id}:${m.product_id}`
    const prev = lastDate.get(key)
    if (!prev || m.movement_date > prev) {
      lastDate.set(key, m.movement_date)
      if (m.field_name) fieldByKey.set(key, m.field_name)
    }
    if (m.movement_date && m.movement_date === lastDate.get(key)) {
      const d = new Date(m.movement_date)
      if (!Number.isNaN(d.getTime())) {
        monthByKey.set(key, d.toLocaleString('es-CL', { month: 'long' }).toUpperCase())
      }
    }
  }

  const rows: PhytoStockRow[] = []
  for (const w of input.warehouses.filter(x => x.is_active)) {
    for (const p of input.products.filter(x => x.is_active)) {
      const key = `${w.id}:${p.id}`
      const stock = stockMap.get(key) ?? 0
      const flow = flowMap.get(key)
      if (stock === 0 && !flow && !lastDate.has(key)) continue
      rows.push({
        warehouse_id: w.id,
        product_id: p.id,
        warehouse_name: w.name,
        product_name: p.name,
        field_name: fieldByKey.get(key) ?? w.field?.name ?? w.name.replace(/^BODEGA\s+/i, ''),
        category: p.category,
        product_type_label: p.product_type_label,
        unit: p.unit,
        stock,
        entries_total: flow?.entries ?? 0,
        exits_total: flow?.exits ?? 0,
        min_stock: p.min_stock,
        supplier_name: p.supplier_name,
        last_movement_date: lastDate.get(key) ?? null,
        month_label: monthByKey.get(key) ?? '',
      })
    }
  }

  return rows.sort((a, b) =>
    a.warehouse_name.localeCompare(b.warehouse_name)
    || a.product_name.localeCompare(b.product_name),
  )
}

export function stockStatus(stock: number, minStock: number | null): 'ok' | 'low' | 'critical' | 'none' {
  if (minStock == null) return stock > 0 ? 'ok' : 'none'
  if (stock <= 0) return 'critical'
  if (stock < minStock) return 'low'
  return 'ok'
}

export function aggregateStockByProduct(
  rows: PhytoStockRow[],
): Map<string, { product_name: string; unit: string; stock: number; product_id: string }> {
  const map = new Map<string, { product_name: string; unit: string; stock: number; product_id: string }>()
  for (const r of rows) {
    const prev = map.get(r.product_id) ?? { product_name: r.product_name, unit: r.unit, stock: 0, product_id: r.product_id }
    prev.stock += r.stock
    map.set(r.product_id, prev)
  }
  return map
}

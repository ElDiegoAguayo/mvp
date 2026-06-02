import type { PhytoProduct, PhytoPurchaseInvoice, PhytoStockRow } from '@/lib/fitosanitario/types'

export interface SupplierShareRow {
  supplier_name: string
  total_clp: number
  quantity: number
  invoice_count: number
  share_pct: number
}

export interface SupplierByTypeRow {
  product_type_label: string
  supplier_name: string
  total_clp: number
  share_pct: number
}

export interface SupplierByTargetRow {
  target_label: string
  supplier_name: string
  total_clp: number
  share_pct: number
}

export interface SupplierOfferRow {
  supplier_name: string
  product_name: string
  product_type_label: string
  target_label: string
  unit: string
  unit_price: number
  last_purchase_date: string | null
  purchase_count: number
}

export interface EnrichedInvoice extends PhytoPurchaseInvoice {
  target_label: string
}

export interface ProgramCoverageRow {
  product_id: string | null
  product_name: string
  unit: string
  planned_total: number
  stock_total: number
  coverage_pct: number | null
  gap: number
}

export interface SupplierComparisonRow {
  product_name: string
  product_type_label: string
  baseline_price: number | null
  compare_price: number | null
  price_diff_pct: number | null
  baseline_supplier: string
  compare_supplier: string
}

export function computeSupplierShares(
  invoices: EnrichedInvoice[],
  targetFilter?: string,
): SupplierShareRow[] {
  const filtered = targetFilter
    ? invoices.filter(i => i.target_label.toLowerCase().includes(targetFilter.toLowerCase()))
    : invoices

  const map = new Map<string, { total_clp: number; quantity: number; count: number }>()
  let grandTotal = 0

  for (const inv of filtered) {
    const key = inv.supplier_name.trim() || 'Sin proveedor'
    const prev = map.get(key) ?? { total_clp: 0, quantity: 0, count: 0 }
    const total = inv.total_clp ?? 0
    prev.total_clp += total
    prev.quantity += inv.quantity
    prev.count += 1
    map.set(key, prev)
    grandTotal += total
  }

  return [...map.entries()]
    .map(([supplier_name, v]) => ({
      supplier_name,
      total_clp: v.total_clp,
      quantity: v.quantity,
      invoice_count: v.count,
      share_pct: grandTotal > 0 ? (v.total_clp / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total_clp - a.total_clp)
}

export function computeSupplierByType(
  invoices: EnrichedInvoice[],
  typeFilter?: string,
): SupplierByTypeRow[] {
  const filtered = typeFilter
    ? invoices.filter(i =>
        i.product_type_label.toLowerCase().includes(typeFilter.toLowerCase()),
      )
    : invoices

  const typeMap = new Map<string, Map<string, number>>()
  for (const inv of filtered) {
    const tipo = inv.product_type_label.trim() || 'Sin tipo'
    const supplier = inv.supplier_name.trim() || 'Sin proveedor'
    if (!typeMap.has(tipo)) typeMap.set(tipo, new Map())
    const sm = typeMap.get(tipo)!
    sm.set(supplier, (sm.get(supplier) ?? 0) + (inv.total_clp ?? 0))
  }

  const rows: SupplierByTypeRow[] = []
  for (const [product_type_label, suppliers] of typeMap) {
    const typeTotal = [...suppliers.values()].reduce((a, b) => a + b, 0)
    for (const [supplier_name, total_clp] of suppliers) {
      rows.push({
        product_type_label,
        supplier_name,
        total_clp,
        share_pct: typeTotal > 0 ? (total_clp / typeTotal) * 100 : 0,
      })
    }
  }

  return rows.sort((a, b) =>
    a.product_type_label.localeCompare(b.product_type_label)
    || b.total_clp - a.total_clp,
  )
}

export function computeSupplierByTarget(
  invoices: EnrichedInvoice[],
  targetFilter?: string,
): SupplierByTargetRow[] {
  const withTarget = invoices.filter(i => i.target_label.trim())
  const filtered = targetFilter
    ? withTarget.filter(i =>
        i.target_label.toLowerCase().includes(targetFilter.toLowerCase()),
      )
    : withTarget

  const targetMap = new Map<string, Map<string, number>>()
  for (const inv of filtered) {
    const target = inv.target_label.trim()
    const supplier = inv.supplier_name.trim() || 'Sin proveedor'
    if (!targetMap.has(target)) targetMap.set(target, new Map())
    const sm = targetMap.get(target)!
    sm.set(supplier, (sm.get(supplier) ?? 0) + (inv.total_clp ?? 0))
  }

  const rows: SupplierByTargetRow[] = []
  for (const [target_label, suppliers] of targetMap) {
    const targetTotal = [...suppliers.values()].reduce((a, b) => a + b, 0)
    for (const [supplier_name, total_clp] of suppliers) {
      rows.push({
        target_label,
        supplier_name,
        total_clp,
        share_pct: targetTotal > 0 ? (total_clp / targetTotal) * 100 : 0,
      })
    }
  }

  return rows.sort((a, b) =>
    a.target_label.localeCompare(b.target_label)
    || b.total_clp - a.total_clp,
  )
}

export function searchSupplierOffers(
  invoices: EnrichedInvoice[],
  products: PhytoProduct[],
  filters: {
    productType?: string
    target?: string
    search?: string
  },
): SupplierOfferRow[] {
  const productById = new Map(products.map(p => [p.id, p]))
  const productByName = new Map(products.map(p => [p.name.trim().toLowerCase(), p]))

  const enriched = invoices.map(inv => {
    const fromId = inv.product_id ? productById.get(inv.product_id) : undefined
    const fromName = productByName.get(inv.product_name.trim().toLowerCase())
    const product = fromId ?? fromName
    return {
      ...inv,
      target_label: inv.target_label || product?.target_label || '',
      product_type_label: inv.product_type_label || product?.product_type_label || '',
    }
  })

  const filtered = enriched.filter(inv => {
    if (filters.productType && !inv.product_type_label.toLowerCase().includes(filters.productType.toLowerCase())) {
      return false
    }
    if (filters.target && !inv.target_label.toLowerCase().includes(filters.target.toLowerCase())) {
      return false
    }
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (
        !inv.product_name.toLowerCase().includes(q)
        && !inv.supplier_name.toLowerCase().includes(q)
      ) return false
    }
    return inv.unit_price != null && inv.unit_price > 0
  })

  const map = new Map<string, {
    supplier_name: string
    product_name: string
    product_type_label: string
    target_label: string
    unit: string
    prices: number[]
    dates: string[]
  }>()

  for (const inv of filtered) {
    const key = `${inv.supplier_name.toLowerCase()}::${inv.product_name.toLowerCase()}`
    const prev = map.get(key) ?? {
      supplier_name: inv.supplier_name,
      product_name: inv.product_name,
      product_type_label: inv.product_type_label,
      target_label: inv.target_label,
      unit: inv.unit,
      prices: [],
      dates: [],
    }
    if (inv.unit_price != null) prev.prices.push(inv.unit_price)
    if (inv.issue_date) prev.dates.push(inv.issue_date)
    map.set(key, prev)
  }

  return [...map.values()]
    .map(v => ({
      supplier_name: v.supplier_name,
      product_name: v.product_name,
      product_type_label: v.product_type_label,
      target_label: v.target_label,
      unit: v.unit,
      unit_price: v.prices.reduce((a, b) => a + b, 0) / v.prices.length,
      last_purchase_date: v.dates.sort().pop() ?? null,
      purchase_count: v.prices.length,
    }))
    .sort((a, b) => a.unit_price - b.unit_price)
}

export function computeProgramCoverage(input: {
  plannedByProduct: Array<{ product_id: string | null; product_name: string; unit: string; total: number }>
  stockRows: PhytoStockRow[]
}): ProgramCoverageRow[] {
  const stockByProduct = new Map<string, { total: number; unit: string; name: string }>()
  for (const row of input.stockRows) {
    const prev = stockByProduct.get(row.product_id) ?? { total: 0, unit: row.unit, name: row.product_name }
    prev.total += row.stock
    stockByProduct.set(row.product_id, prev)
  }

  return input.plannedByProduct.map(p => {
    const stock = p.product_id ? stockByProduct.get(p.product_id) : undefined
    const stock_total = stock?.total ?? 0
    const gap = p.total - stock_total
    return {
      product_id: p.product_id,
      product_name: p.product_name,
      unit: p.unit,
      planned_total: p.total,
      stock_total,
      coverage_pct: p.total > 0 ? Math.min(100, (stock_total / p.total) * 100) : null,
      gap,
    }
  }).sort((a, b) => b.gap - a.gap)
}

export function compareSuppliers(
  invoices: PhytoPurchaseInvoice[],
  baselineSupplier: string,
  compareSupplier: string,
  products: PhytoProduct[],
): SupplierComparisonRow[] {
  const avgPrice = (supplier: string, productName: string) => {
    const rows = invoices.filter(
      i =>
        i.supplier_name.trim().toLowerCase() === supplier.trim().toLowerCase()
        && i.product_name.trim().toLowerCase() === productName.trim().toLowerCase()
        && i.unit_price != null,
    )
    if (!rows.length) return null
    return rows.reduce((s, r) => s + (r.unit_price ?? 0), 0) / rows.length
  }

  const productNames = new Set<string>()
  for (const inv of invoices) {
    if (
      inv.supplier_name.trim().toLowerCase() === baselineSupplier.trim().toLowerCase()
      || inv.supplier_name.trim().toLowerCase() === compareSupplier.trim().toLowerCase()
    ) {
      productNames.add(inv.product_name.trim())
    }
  }

  const rows: SupplierComparisonRow[] = []
  for (const product_name of productNames) {
    const product = products.find(p => p.name.trim().toLowerCase() === product_name.toLowerCase())
    const baseline_price = avgPrice(baselineSupplier, product_name)
    const compare_price = avgPrice(compareSupplier, product_name)
    let price_diff_pct: number | null = null
    if (baseline_price != null && compare_price != null && baseline_price > 0) {
      price_diff_pct = ((compare_price - baseline_price) / baseline_price) * 100
    }
    rows.push({
      product_name,
      product_type_label: product?.product_type_label ?? '',
      baseline_price,
      compare_price,
      price_diff_pct,
      baseline_supplier: baselineSupplier,
      compare_supplier: compareSupplier,
    })
  }

  return rows.sort((a, b) => {
    const da = Math.abs(a.price_diff_pct ?? 0)
    const db = Math.abs(b.price_diff_pct ?? 0)
    return db - da
  })
}

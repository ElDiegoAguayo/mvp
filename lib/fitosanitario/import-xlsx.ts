import * as XLSX from 'xlsx'
import { calculateApplicationTotal, excelSerialToIso, parseCurrency, parseLocaleNumber, parseQuantityWithUnit } from '@/lib/fitosanitario/application-calc'
import { tipoToCategory, sanitizeProductTypeLabel } from '@/lib/fitosanitario/categories'
import type { PhytoImportSummary, PhytoMovementType } from '@/lib/fitosanitario/types'

export interface ParsedPhytoProduct {
  key: string
  name: string
  product_type_label: string
  category: ReturnType<typeof tipoToCategory>
  unit: string
  supplier_name: string
}

export interface ParsedPhytoWarehouse {
  key: string
  name: string
  field_name: string
}

export interface ParsedPhytoMovement {
  movement_date: string | null
  field_name: string
  product_key: string
  product_name: string
  type: PhytoMovementType
  quantity: number
  unit: string
  product_type_label: string
  supplier_name: string
  unit_price: number | null
  total_clp: number | null
  warehouse_key: string
}

export interface ParsedPhytoInvoice {
  invoice_number: string
  supplier_name: string
  client_name: string
  field_name: string
  issue_date: string | null
  month_label: string
  product_key: string
  product_name: string
  quantity: number
  unit: string
  unit_price: number | null
  net_amount: number | null
  tax_amount: number | null
  total_clp: number | null
  product_type_label: string
  warehouse_key: string
}

export interface ParsedPhytoProgramItem {
  month_label: string
  stage_label: string
  application_date: string | null
  application_end_date: string | null
  field_name: string
  product_key: string
  product_name: string
  dose_label: string
  spray_volume_l_ha: number | null
  application_area_label: string
  status: 'planned' | 'applied' | 'cancelled'
  surface_ha: number | null
  total_required: number | null
  total_applied: number | null
  unit: string
}

export interface ParsedPhytoContainer {
  warehouse_key: string
  product_key: string
  product_name: string
  product_type_label: string
  container_count: number
  pack_size_label: string
  open_count: number
}

export interface ParsedPhytoWorkbook {
  warehouses: ParsedPhytoWarehouse[]
  products: ParsedPhytoProduct[]
  movements: ParsedPhytoMovement[]
  invoices: ParsedPhytoInvoice[]
  programItems: ParsedPhytoProgramItem[]
  containers: ParsedPhytoContainer[]
}

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normProductKey(name: string): string {
  return normKey(name)
}

function warehouseKeyFromField(field: string): string {
  const f = field.trim().toUpperCase()
  if (!f) return 'general'
  return normKey(`BODEGA ${f.replace(/^EL\s+/, 'EL ')}`)
}

function warehouseNameFromKey(key: string): string {
  if (key === 'general') return 'Bodega general'
  return key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function cellStr(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

function mapMovementType(raw: string): PhytoMovementType {
  const t = raw.toLowerCase()
  if (t.includes('salida')) return 'salida'
  if (t.includes('ajuste')) return 'ajuste'
  return 'entrada'
}

function mapApplicationStatus(raw: string): 'planned' | 'applied' | 'cancelled' {
  const t = raw.toLowerCase()
  if (t.includes('aplicad')) return 'applied'
  if (t.includes('cancel')) return 'cancelled'
  return 'planned'
}

function lastDayOfMonthIso(iso: string): string {
  const [y, mo] = iso.split('-').map(Number)
  const day = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** FECHA = inicio; columna MES (serial Excel) = fin de ventana cuando es fecha válida del mismo mes. */
function inferApplicationEndDate(appDate: string | null, monthRaw: unknown): string | null {
  if (!appDate) return null
  const fromMes = typeof monthRaw === 'number' ? excelSerialToIso(monthRaw) : null
  if (fromMes && fromMes >= appDate) {
    const startMs = new Date(appDate).getTime()
    const endMs = new Date(fromMes).getTime()
    const daysDiff = (endMs - startMs) / 86400000
    if (daysDiff <= 45) return fromMes
  }
  return lastDayOfMonthIso(appDate)
}

function monthLabelFromDate(iso: string | null, fallback = ''): string {
  if (!iso) return fallback
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return fallback
  return d.toLocaleString('es-CL', { month: 'long' }).toUpperCase()
}

function upsertProduct(
  map: Map<string, ParsedPhytoProduct>,
  name: string,
  tipo: string,
  unit: string,
  supplier = '',
) {
  const key = normProductKey(name)
  if (!key) return
  const cleanTipo = sanitizeProductTypeLabel(tipo)
  const existing = map.get(key)
  if (existing) {
    if (!existing.supplier_name && supplier) existing.supplier_name = supplier
    if (cleanTipo) {
      existing.product_type_label = cleanTipo
      existing.category = tipoToCategory(cleanTipo)
    }
    if (existing.unit === 'L' && unit) existing.unit = unit
    return
  }
  map.set(key, {
    key,
    name: name.trim(),
    product_type_label: cleanTipo,
    category: tipoToCategory(cleanTipo),
    unit: unit.trim().toUpperCase().replace('LT', 'L') || 'L',
    supplier_name: supplier.trim(),
  })
}

function upsertWarehouse(map: Map<string, ParsedPhytoWarehouse>, fieldOrName: string) {
  const field = fieldOrName.trim()
  if (!field) return
  const key = warehouseKeyFromField(field)
  if (!map.has(key)) {
    map.set(key, {
      key,
      name: warehouseNameFromKey(key),
      field_name: field.toUpperCase(),
    })
  }
}

export function parsePhytoWorkbook(buffer: ArrayBuffer): ParsedPhytoWorkbook {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const products = new Map<string, ParsedPhytoProduct>()
  const warehouses = new Map<string, ParsedPhytoWarehouse>()
  const movements: ParsedPhytoMovement[] = []
  const invoices: ParsedPhytoInvoice[] = []
  const programItems: ParsedPhytoProgramItem[] = []
  const containers: ParsedPhytoContainer[] = []

  const sheetJson = (name: string) => {
    const sheet = wb.Sheets[name]
    if (!sheet) return [] as Record<string, unknown>[]
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  }

  for (const row of sheetJson('Facturas')) {
    const productName = cellStr(row, 'Producto')
    if (!productName) continue
    const field = cellStr(row, 'CAMPO')
    const tipo = cellStr(row, 'Tipo de Producto')
    const unit = cellStr(row, 'UNIDAD') || 'UN'
    const supplier = cellStr(row, 'Empresa')
    upsertProduct(products, productName, tipo, unit, supplier)
    upsertWarehouse(warehouses, field)
    const issueDate = excelSerialToIso(row['Fecha Emisión'])
    const qty = parseLocaleNumber(row.Cantidad) ?? 0
    invoices.push({
      invoice_number: String(row['N° Boleta'] ?? ''),
      supplier_name: supplier,
      client_name: cellStr(row, 'Cliente'),
      field_name: field,
      issue_date: issueDate,
      month_label: cellStr(row, 'MES') || monthLabelFromDate(issueDate),
      product_key: normProductKey(productName),
      product_name: productName,
      quantity: qty,
      unit,
      unit_price: parseCurrency(row['Precio por Unidad']),
      net_amount: parseCurrency(row['Monto Neto']),
      tax_amount: parseCurrency(row['IVA (19%)']),
      total_clp: parseCurrency(row['Total CLP']),
      product_type_label: tipo,
      warehouse_key: warehouseKeyFromField(field),
    })
  }

  for (const row of sheetJson('Movimientos')) {
    const productName = cellStr(row, 'Producto')
    if (!productName) continue
    const field = cellStr(row, 'Campo')
    const tipo = cellStr(row, 'Tipo de Producto')
    const unit = cellStr(row, 'Unidad') || 'L'
    const supplier = cellStr(row, 'Empresa')
    upsertProduct(products, productName, tipo, unit, supplier)
    upsertWarehouse(warehouses, field)
    movements.push({
      movement_date: excelSerialToIso(row.Fecha),
      field_name: field,
      product_key: normProductKey(productName),
      product_name: productName,
      type: mapMovementType(cellStr(row, 'Movimiento')),
      quantity: parseLocaleNumber(row.Cantidad) ?? 0,
      unit,
      product_type_label: tipo,
      supplier_name: supplier,
      unit_price: parseCurrency(row['Precio Unitario']),
      total_clp: parseCurrency(row['Total CLP']),
      warehouse_key: warehouseKeyFromField(field),
    })
  }

  for (const row of sheetJson('Programa De Apliaciones')) {
    const productName = cellStr(row, 'DESCRIPCION')
    if (!productName) continue
    const field = cellStr(row, 'CAMPO')
    upsertProduct(products, productName, '', 'L')
    upsertWarehouse(warehouses, field)
    const dose = cellStr(row, 'DOSIS')
    const spray = parseLocaleNumber(row.MOJAMIENTO)
    const surface = parseLocaleNumber(row['Superficie (ha)'])
    const calc = calculateApplicationTotal({ doseLabel: dose, sprayVolumeLHa: spray, surfaceHa: surface })
    const appliedRaw = row['Producto total Aplicado']
    const parsedApplied = parseQuantityWithUnit(appliedRaw)
    const appDate = excelSerialToIso(row.FECHA)
    const monthRaw = row.MES
    const monthLabel = typeof monthRaw === 'number'
      ? monthLabelFromDate(excelSerialToIso(monthRaw))
      : cellStr(row, 'MES')

    programItems.push({
      month_label: monthLabel,
      stage_label: cellStr(row, 'ETAPA'),
      application_date: appDate,
      application_end_date: inferApplicationEndDate(appDate, monthRaw),
      field_name: field,
      product_key: normProductKey(productName),
      product_name: productName,
      dose_label: dose,
      spray_volume_l_ha: spray,
      application_area_label: cellStr(row, 'Donde se Aplico'),
      status: mapApplicationStatus(cellStr(row, 'Estado ')),
      surface_ha: surface,
      total_required: calc?.total ?? parsedApplied?.quantity ?? null,
      total_applied: parsedApplied?.quantity ?? (cellStr(row, 'Estado ').toLowerCase().includes('aplicad') ? calc?.total ?? null : null),
      unit: parsedApplied?.unit ?? calc?.unit ?? 'L',
    })
  }

  for (const name of wb.SheetNames) {
    if (!name.toUpperCase().startsWith('BODEGA ')) continue
    const whKey = normKey(name)
    warehouses.set(whKey, {
      key: whKey,
      name,
      field_name: name.replace(/^BODEGA\s+/i, '').trim(),
    })

    const rows = sheetJson(name)
    if (!rows.length) continue
    const headers = Object.keys(rows[0] ?? {})
    const isContainerFormat = headers.some(h => h.toUpperCase().includes('LT/KG'))

    for (const row of rows) {
      const productName = cellStr(row, 'PRODUCTO')
      if (!productName) continue
      const tipo = cellStr(row, 'Tipo de producto', 'Tipo de Producto')
      if (isContainerFormat) {
        upsertProduct(products, productName, tipo, 'L')
        containers.push({
          warehouse_key: whKey,
          product_key: normProductKey(productName),
          product_name: productName,
          product_type_label: tipo,
          container_count: parseLocaleNumber(row.UNIDAD) ?? 0,
          pack_size_label: cellStr(row, 'LT/KG(c/u)'),
          open_count: parseLocaleNumber(row.ABIERTOS) ?? 0,
        })
      } else {
        const unit = cellStr(row, 'UNIDAD') || 'L'
        const qty = parseLocaleNumber(row.CANTIDAD) ?? 0
        upsertProduct(products, productName, tipo, unit)
        if (qty > 0) {
          movements.push({
            movement_date: null,
            field_name: cellStr(row, 'Campo') || name.replace(/^BODEGA\s+/i, ''),
            product_key: normProductKey(productName),
            product_name: productName,
            type: 'entrada',
            quantity: qty,
            unit,
            product_type_label: tipo,
            supplier_name: '',
            unit_price: null,
            total_clp: null,
            warehouse_key: whKey,
          })
        }
      }
    }
  }

  return {
    warehouses: [...warehouses.values()],
    products: [...products.values()],
    movements,
    invoices,
    programItems,
    containers,
  }
}

export function summarizeParsedWorkbook(data: ParsedPhytoWorkbook): PhytoImportSummary {
  return {
    warehouses: data.warehouses.length,
    products: data.products.length,
    movements: data.movements.length,
    invoices: data.invoices.length,
    programItems: data.programItems.length,
    containers: data.containers.length,
  }
}

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getDataOwnerId } from '@/lib/supabase/effective-user-server'
import {
  compareSuppliers,
  computeProgramCoverage,
  computeSupplierByTarget,
  computeSupplierByType,
  computeSupplierShares,
  searchSupplierOffers,
  type EnrichedInvoice,
} from '@/lib/fitosanitario/analytics'
import { calculateApplicationTotal } from '@/lib/fitosanitario/application-calc'
import { parsePhytoWorkbook, summarizeParsedWorkbook } from '@/lib/fitosanitario/import-xlsx'
import { sanitizeProductTypeLabel } from '@/lib/fitosanitario/categories'
import { syncPhytoProductCategoriesAction } from '@/app/actions/fitosanitario-actions'
import { buildStockRows } from '@/lib/fitosanitario/stock'
import {
  buildStockTimeline,
  computeProgressiveSchedule,
  inferProgramDateRange,
} from '@/lib/fitosanitario/program-schedule'
import type {
  PhytoApplicationItem,
  PhytoApplicationProgram,
  PhytoImportSummary,
  PhytoProduct,
  PhytoPurchaseInvoice,
  PhytoWarehouseContainer,
} from '@/lib/fitosanitario/types'

const REVALIDATE_PATHS = [
  '/dashboard/inventario-fitosanitario',
  '/dashboard/inventario-fitosanitario/stock',
  '/dashboard/inventario-fitosanitario/movimientos',
  '/dashboard/inventario-fitosanitario/facturas',
  '/dashboard/inventario-fitosanitario/programa',
  '/dashboard/inventario-fitosanitario/analisis',
  '/dashboard/inventario-fitosanitario/comparador',
  '/dashboard/inventario-fitosanitario/bodegas',
  '/dashboard/inventario-fitosanitario/productos',
]

function revalidateAll() {
  for (const p of REVALIDATE_PATHS) revalidatePath(p)
}

async function requireOwnerId(): Promise<string | null> {
  const supabase = await createClient()
  return getDataOwnerId(supabase)
}

async function loadEnrichedInvoices(): Promise<
  { ok: true; data: EnrichedInvoice[]; products: PhytoProduct[] } | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const [invRes, pRes] = await Promise.all([
    listPhytoInvoicesAction(5000),
    supabase.from('phyto_products').select('*').eq('user_id', ownerId),
  ])

  if (!invRes.ok) return invRes

  const products: PhytoProduct[] = (pRes.data ?? []).map(r => ({
    id: String(r.id),
    user_id: String(r.user_id),
    name: String(r.name),
    brand: String(r.brand ?? ''),
    supplier_name: String(r.supplier_name ?? ''),
    category: String(r.category ?? 'other') as PhytoProduct['category'],
    product_type_label: String(r.product_type_label ?? ''),
    target_label: String(r.target_label ?? ''),
    active_ingredient: String(r.active_ingredient ?? ''),
    unit: String(r.unit ?? 'L'),
    min_stock: r.min_stock != null ? Number(r.min_stock) : null,
    is_active: Boolean(r.is_active),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }))

  const productById = new Map(products.map(p => [p.id, p]))
  const productByName = new Map(products.map(p => [p.name.trim().toLowerCase(), p]))

  const data: EnrichedInvoice[] = invRes.data.map(inv => {
    const product =
      (inv.product_id ? productById.get(inv.product_id) : undefined)
      ?? productByName.get(inv.product_name.trim().toLowerCase())
    return {
      ...inv,
      target_label: product?.target_label ?? '',
    }
  })

  return { ok: true, data, products }
}

function mapStockContext(
  wRes: { data: unknown[] | null },
  pRes: { data: unknown[] | null },
  mRes: { data: unknown[] | null },
) {
  return buildStockRows({
    warehouses: (wRes.data ?? []).map(r => {
      const row = r as Record<string, unknown>
      return {
        id: String(row.id),
        user_id: String(row.user_id),
        field_id: row.field_id != null ? String(row.field_id) : null,
        name: String(row.name),
        location: String(row.location ?? ''),
        notes: String(row.notes ?? ''),
        is_active: Boolean(row.is_active),
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
      }
    }),
    products: (pRes.data ?? []).map(r => {
      const row = r as Record<string, unknown>
      return {
        id: String(row.id),
        user_id: String(row.user_id),
        name: String(row.name),
        brand: String(row.brand ?? ''),
        supplier_name: String(row.supplier_name ?? ''),
        category: String(row.category ?? 'other') as PhytoProduct['category'],
        product_type_label: String(row.product_type_label ?? ''),
        target_label: String(row.target_label ?? ''),
        active_ingredient: String(row.active_ingredient ?? ''),
        unit: String(row.unit ?? 'L'),
        min_stock: row.min_stock != null ? Number(row.min_stock) : null,
        is_active: Boolean(row.is_active),
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
      }
    }),
    movements: (mRes.data ?? []).map(r => {
      const row = r as Record<string, unknown>
      return {
        id: String(row.id),
        user_id: String(row.user_id),
        warehouse_id: String(row.warehouse_id),
        product_id: String(row.product_id),
        type: String(row.type) as 'entrada' | 'salida' | 'ajuste',
        quantity: Number(row.quantity) || 0,
        unit: String(row.unit ?? 'L'),
        lot_number: String(row.lot_number ?? ''),
        expiry_date: row.expiry_date != null ? String(row.expiry_date) : null,
        reference: String(row.reference ?? ''),
        notes: String(row.notes ?? ''),
        movement_date: String(row.movement_date ?? ''),
        supplier_name: String(row.supplier_name ?? ''),
        field_name: String(row.field_name ?? ''),
        unit_price: row.unit_price != null ? Number(row.unit_price) : null,
        total_clp: row.total_clp != null ? Number(row.total_clp) : null,
        product_type_label: String(row.product_type_label ?? ''),
        application_item_id: row.application_item_id != null ? String(row.application_item_id) : null,
        created_at: String(row.created_at),
      }
    }),
  })
}

function mapInvoice(row: Record<string, unknown>): PhytoPurchaseInvoice {
  return {
    id: String(row.id),
    invoice_number: String(row.invoice_number ?? ''),
    supplier_name: String(row.supplier_name ?? ''),
    client_name: String(row.client_name ?? ''),
    field_name: String(row.field_name ?? ''),
    warehouse_id: row.warehouse_id != null ? String(row.warehouse_id) : null,
    product_id: row.product_id != null ? String(row.product_id) : null,
    issue_date: row.issue_date != null ? String(row.issue_date) : null,
    month_label: String(row.month_label ?? ''),
    product_name: String(row.product_name ?? ''),
    quantity: Number(row.quantity) || 0,
    unit: String(row.unit ?? 'L'),
    unit_price: row.unit_price != null ? Number(row.unit_price) : null,
    net_amount: row.net_amount != null ? Number(row.net_amount) : null,
    tax_amount: row.tax_amount != null ? Number(row.tax_amount) : null,
    total_clp: row.total_clp != null ? Number(row.total_clp) : null,
    product_type_label: String(row.product_type_label ?? ''),
    movement_id: row.movement_id != null ? String(row.movement_id) : null,
  }
}

function mapProgram(row: Record<string, unknown>): PhytoApplicationProgram {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    field_name: String(row.field_name ?? ''),
    season_label: String(row.season_label ?? ''),
    start_date: row.start_date != null ? String(row.start_date) : null,
    end_date: row.end_date != null ? String(row.end_date) : null,
    notes: String(row.notes ?? ''),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

function mapApplicationItem(row: Record<string, unknown>): PhytoApplicationItem {
  return {
    id: String(row.id),
    program_id: String(row.program_id),
    month_label: String(row.month_label ?? ''),
    stage_label: String(row.stage_label ?? ''),
    application_date: row.application_date != null ? String(row.application_date) : null,
    application_end_date: row.application_end_date != null ? String(row.application_end_date) : null,
    field_name: String(row.field_name ?? ''),
    product_id: row.product_id != null ? String(row.product_id) : null,
    product_name: String(row.product_name ?? ''),
    dose_label: String(row.dose_label ?? ''),
    spray_volume_l_ha: row.spray_volume_l_ha != null ? Number(row.spray_volume_l_ha) : null,
    application_area_label: String(row.application_area_label ?? ''),
    status: String(row.status ?? 'planned') as PhytoApplicationItem['status'],
    surface_ha: row.surface_ha != null ? Number(row.surface_ha) : null,
    total_required: row.total_required != null ? Number(row.total_required) : null,
    total_applied: row.total_applied != null ? Number(row.total_applied) : null,
    unit: String(row.unit ?? 'L'),
    target_label: String(row.target_label ?? ''),
    sort_order: Number(row.sort_order) || 0,
  }
}

function mapContainer(row: Record<string, unknown>): PhytoWarehouseContainer {
  const warehouse = row.warehouse as Record<string, unknown> | null | undefined
  const product = row.product as Record<string, unknown> | null | undefined
  return {
    id: String(row.id),
    warehouse_id: String(row.warehouse_id),
    product_id: String(row.product_id),
    container_count: Number(row.container_count) || 0,
    pack_size_label: String(row.pack_size_label ?? ''),
    open_count: Number(row.open_count) || 0,
    notes: String(row.notes ?? ''),
    warehouse: warehouse
      ? { id: String(warehouse.id), name: String(warehouse.name ?? '') }
      : undefined,
    product: product
      ? {
          id: String(product.id),
          name: String(product.name ?? ''),
          product_type_label: String(product.product_type_label ?? ''),
          unit: String(product.unit ?? 'L'),
        }
      : undefined,
  }
}

export async function listPhytoInvoicesAction(limit = 200): Promise<
  { ok: true; data: PhytoPurchaseInvoice[] } | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('phyto_purchase_invoices')
    .select('*')
    .eq('user_id', ownerId)
    .order('issue_date', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) return { ok: false, message: error.message }
  return { ok: true, data: (data ?? []).map(r => mapInvoice(r as Record<string, unknown>)) }
}

export async function listPhytoApplicationItemsAction(): Promise<
  { ok: true; program: PhytoApplicationProgram | null; items: PhytoApplicationItem[] }
  | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { data: programs } = await supabase
    .from('phyto_application_programs')
    .select('*')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(1)

  const program = programs?.[0]
  if (!program) return { ok: true, program: null, items: [] }

  const { data: items, error } = await supabase
    .from('phyto_application_items')
    .select('*')
    .eq('program_id', program.id)
    .eq('user_id', ownerId)
    .order('application_date', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true })

  if (error) return { ok: false, message: error.message }
  return {
    ok: true,
    program: mapProgram(program as Record<string, unknown>),
    items: (items ?? []).map(r => mapApplicationItem(r as Record<string, unknown>)),
  }
}

export async function savePhytoApplicationItemAction(input: {
  id?: string
  program_id?: string
  month_label?: string
  stage_label?: string
  application_date?: string | null
  application_end_date?: string | null
  field_name?: string
  product_id?: string | null
  product_name: string
  dose_label?: string
  spray_volume_l_ha?: number | null
  application_area_label?: string
  status?: PhytoApplicationItem['status']
  surface_ha?: number | null
  unit?: string
  target_label?: string
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }
  if (!input.product_name.trim()) return { ok: false, message: 'Product name is required' }

  const supabase = await createClient()
  let programId = input.program_id

  if (!programId) {
    const { data: existing } = await supabase
      .from('phyto_application_programs')
      .select('id')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      programId = String(existing.id)
    } else {
      const { data: created, error: cErr } = await supabase
        .from('phyto_application_programs')
        .insert({
          user_id: ownerId,
          name: 'Programa de aplicaciones',
          field_name: input.field_name?.trim() ?? '',
          season_label: new Date().getFullYear().toString(),
        })
        .select('id')
        .single()
      if (cErr || !created) return { ok: false, message: cErr?.message ?? 'Could not create program' }
      programId = String(created.id)
    }
  }

  const calc = calculateApplicationTotal({
    doseLabel: input.dose_label ?? '',
    sprayVolumeLHa: input.spray_volume_l_ha ?? null,
    surfaceHa: input.surface_ha ?? null,
  })

  let programEndDate: string | null = null
  if (programId && !input.application_end_date) {
    const { data: progRow } = await supabase
      .from('phyto_application_programs')
      .select('end_date')
      .eq('id', programId)
      .maybeSingle()
    programEndDate = progRow?.end_date != null ? String(progRow.end_date) : null
  }

  const payload = {
    program_id: programId,
    user_id: ownerId,
    month_label: input.month_label?.trim() ?? '',
    stage_label: input.stage_label?.trim() ?? '',
    application_date: input.application_date || null,
    application_end_date: input.application_end_date || programEndDate || input.application_date || null,
    field_name: input.field_name?.trim() ?? '',
    product_id: input.product_id || null,
    product_name: input.product_name.trim(),
    dose_label: input.dose_label?.trim() ?? '',
    spray_volume_l_ha: input.spray_volume_l_ha ?? null,
    application_area_label: input.application_area_label?.trim() ?? '',
    status: input.status ?? 'planned',
    surface_ha: input.surface_ha ?? null,
    total_required: calc?.total ?? null,
    total_applied: input.status === 'applied' ? calc?.total ?? null : null,
    unit: input.unit?.trim() || calc?.unit || 'L',
    target_label: input.target_label?.trim() ?? '',
  }

  if (input.id) {
    const { error } = await supabase
      .from('phyto_application_items')
      .update(payload)
      .eq('id', input.id)
      .eq('user_id', ownerId)
    if (error) return { ok: false, message: error.message }
    revalidateAll()
    return { ok: true, id: input.id }
  }

  const { data, error } = await supabase
    .from('phyto_application_items')
    .insert(payload)
    .select('id')
    .single()

  if (error || !data) return { ok: false, message: error?.message ?? 'Could not save item' }
  revalidateAll()
  return { ok: true, id: String(data.id) }
}

export async function deletePhytoApplicationItemAction(id: string): Promise<{ ok: boolean; message?: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('phyto_application_items')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId)

  if (error) return { ok: false, message: error.message }
  revalidateAll()
  return { ok: true }
}

export async function savePhytoProgramDatesAction(input: {
  program_id: string
  start_date?: string | null
  end_date?: string | null
  name?: string
}): Promise<{ ok: boolean; message?: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('phyto_application_programs')
    .update({
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      ...(input.name != null ? { name: input.name.trim() } : {}),
    })
    .eq('id', input.program_id)
    .eq('user_id', ownerId)

  if (error) return { ok: false, message: error.message }

  if (input.end_date) {
    await supabase
      .from('phyto_application_items')
      .update({ application_end_date: input.end_date })
      .eq('program_id', input.program_id)
      .eq('user_id', ownerId)
      .is('application_end_date', null)
      .not('application_date', 'is', null)
  }

  revalidateAll()
  return { ok: true }
}

export async function getPhytoProgramScheduleAction(input?: {
  start_date?: string | null
  end_date?: string | null
}): Promise<
  | {
      ok: true
      program: PhytoApplicationProgram | null
      schedule: ReturnType<typeof computeProgressiveSchedule>
      timeline: ReturnType<typeof buildStockTimeline>
      coverage: ReturnType<typeof computeProgramCoverage>
      inferredRange: ReturnType<typeof inferProgramDateRange>
    }
  | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const [progRes, itemsRes, wRes, pRes, mRes] = await Promise.all([
    supabase.from('phyto_application_programs').select('*').eq('user_id', ownerId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('phyto_application_items').select('*').eq('user_id', ownerId),
    supabase.from('phyto_warehouses').select('*').eq('user_id', ownerId),
    supabase.from('phyto_products').select('*').eq('user_id', ownerId),
    supabase.from('phyto_movements').select('*').eq('user_id', ownerId),
  ])

  if (itemsRes.error) return { ok: false, message: itemsRes.error.message }

  const productById = new Map((pRes.data ?? []).map(r => [String(r.id), r]))
  const items = (itemsRes.data ?? []).map(r => mapApplicationItem(r as Record<string, unknown>))
  const program = progRes.data ? mapProgram(progRes.data as Record<string, unknown>) : null

  const startDate = input?.start_date ?? program?.start_date ?? null
  const endDate = input?.end_date ?? program?.end_date ?? null
  const stockRows = mapStockContext(wRes, pRes, mRes)

  const schedule = computeProgressiveSchedule({
    items: items.map(i => ({
      ...i,
      target_label: i.target_label || (i.product_id ? String(productById.get(i.product_id)?.target_label ?? '') : ''),
    })),
    stockRows,
    startDate,
    endDate,
  })

  const plannedMap = new Map<string, { product_id: string | null; product_name: string; unit: string; total: number }>()
  for (const row of schedule) {
    if (row.qty <= 0) continue
    const key = row.product_id ?? `name:${row.product_name.toLowerCase()}`
    const prev = plannedMap.get(key) ?? {
      product_id: row.product_id,
      product_name: row.product_name,
      unit: row.unit,
      total: 0,
    }
    prev.total += row.qty
    plannedMap.set(key, prev)
  }

  return {
    ok: true,
    program,
    schedule,
    timeline: buildStockTimeline(schedule),
    coverage: computeProgramCoverage({ plannedByProduct: [...plannedMap.values()], stockRows }),
    inferredRange: inferProgramDateRange(items),
  }
}

export async function listPhytoContainersAction(): Promise<
  { ok: true; data: PhytoWarehouseContainer[] } | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('phyto_warehouse_containers')
    .select('*, warehouse:warehouse_id (id, name), product:product_id (id, name, product_type_label, unit)')
    .eq('user_id', ownerId)
    .order('warehouse_id')

  if (error) return { ok: false, message: error.message }
  return { ok: true, data: (data ?? []).map(r => mapContainer(r as Record<string, unknown>)) }
}

export async function getPhytoProgramCoverageAction(): Promise<
  | { ok: true; rows: ReturnType<typeof computeProgramCoverage> }
  | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const [itemsRes, wRes, pRes, mRes] = await Promise.all([
    supabase.from('phyto_application_items').select('*').eq('user_id', ownerId),
    supabase.from('phyto_warehouses').select('*').eq('user_id', ownerId),
    supabase.from('phyto_products').select('*').eq('user_id', ownerId),
    supabase.from('phyto_movements').select('*').eq('user_id', ownerId),
  ])

  if (itemsRes.error) return { ok: false, message: itemsRes.error.message }

  const plannedMap = new Map<string, { product_id: string | null; product_name: string; unit: string; total: number }>()
  for (const row of itemsRes.data ?? []) {
    if (String(row.status) === 'cancelled') continue
    const qty = Number(row.total_required) || Number(row.total_applied) || 0
    if (qty <= 0) continue
    const key = row.product_id ? String(row.product_id) : `name:${String(row.product_name).toLowerCase()}`
    const prev = plannedMap.get(key) ?? {
      product_id: row.product_id ? String(row.product_id) : null,
      product_name: String(row.product_name),
      unit: String(row.unit ?? 'L'),
      total: 0,
    }
    prev.total += qty
    plannedMap.set(key, prev)
  }

  const stockRows = mapStockContext(wRes, pRes, mRes)

  return {
    ok: true,
    rows: computeProgramCoverage({
      plannedByProduct: [...plannedMap.values()],
      stockRows,
    }),
  }
}

export async function getPhytoSupplierAnalyticsAction(filters?: {
  typeFilter?: string
  targetFilter?: string
}): Promise<
  | {
      ok: true
      shares: ReturnType<typeof computeSupplierShares>
      byType: ReturnType<typeof computeSupplierByType>
      byTarget: ReturnType<typeof computeSupplierByTarget>
      suppliers: string[]
      types: string[]
      targets: string[]
    }
  | { ok: false; message: string }
> {
  const loaded = await loadEnrichedInvoices()
  if (!loaded.ok) return loaded

  const { data, products } = loaded
  const targetFilter = filters?.targetFilter
  const typeFilter = filters?.typeFilter

  const shares = computeSupplierShares(data, targetFilter)
  const byType = computeSupplierByType(data, typeFilter)
  const byTarget = computeSupplierByTarget(data, targetFilter)
  const suppliers = [...new Set(data.map(i => i.supplier_name.trim()).filter(Boolean))].sort()
  const types = [...new Set(data.map(i => i.product_type_label.trim()).filter(Boolean))].sort()
  const targets = [
    ...new Set([
      ...data.map(i => i.target_label.trim()).filter(Boolean),
      ...products.map(p => p.target_label.trim()).filter(Boolean),
    ]),
  ].sort()

  return { ok: true, shares, byType, byTarget, suppliers, types, targets }
}

export async function searchPhytoSupplierOffersAction(filters: {
  productType?: string
  target?: string
  search?: string
}): Promise<
  | { ok: true; rows: ReturnType<typeof searchSupplierOffers>; types: string[]; targets: string[] }
  | { ok: false; message: string }
> {
  const loaded = await loadEnrichedInvoices()
  if (!loaded.ok) return loaded

  const rows = searchSupplierOffers(loaded.data, loaded.products, filters)
  const types = [...new Set(loaded.data.map(i => i.product_type_label.trim()).filter(Boolean))].sort()
  const targets = [
    ...new Set([
      ...loaded.data.map(i => i.target_label.trim()).filter(Boolean),
      ...loaded.products.map(p => p.target_label.trim()).filter(Boolean),
    ]),
  ].sort()

  return { ok: true, rows, types, targets }
}

export async function getPhytoComparatorAction(
  baselineSupplier: string,
  compareSupplier: string,
): Promise<
  | { ok: true; rows: ReturnType<typeof compareSuppliers> }
  | { ok: false; message: string }
> {
  if (!baselineSupplier || !compareSupplier) {
    return { ok: false, message: 'Select two suppliers' }
  }

  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const [invRes, pRes] = await Promise.all([
    listPhytoInvoicesAction(5000),
    supabase.from('phyto_products').select('*').eq('user_id', ownerId),
  ])

  if (!invRes.ok) return invRes

  const products: PhytoProduct[] = (pRes.data ?? []).map(r => ({
    id: String(r.id),
    user_id: String(r.user_id),
    name: String(r.name),
    brand: String(r.brand ?? ''),
    supplier_name: String(r.supplier_name ?? ''),
    category: String(r.category ?? 'other') as PhytoProduct['category'],
    product_type_label: String(r.product_type_label ?? ''),
    target_label: String(r.target_label ?? ''),
    active_ingredient: String(r.active_ingredient ?? ''),
    unit: String(r.unit ?? 'L'),
    min_stock: r.min_stock != null ? Number(r.min_stock) : null,
    is_active: Boolean(r.is_active),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }))

  return {
    ok: true,
    rows: compareSuppliers(invRes.data, baselineSupplier, compareSupplier, products),
  }
}

export async function importPhytoWorkbookAction(
  formData: FormData,
): Promise<{ ok: true; summary: PhytoImportSummary } | { ok: false; message: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, message: 'No file provided' }

  const buffer = await file.arrayBuffer()
  let parsed
  try {
    parsed = parsePhytoWorkbook(buffer)
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not parse workbook' }
  }

  const supabase = await createClient()
  const whIdByKey = new Map<string, string>()
  const prodIdByKey = new Map<string, string>()

  for (const wh of parsed.warehouses) {
    const { data: existing } = await supabase
      .from('phyto_warehouses')
      .select('id')
      .eq('user_id', ownerId)
      .ilike('name', wh.name)
      .maybeSingle()

    if (existing) {
      whIdByKey.set(wh.key, String(existing.id))
      continue
    }

    const { data: created, error } = await supabase
      .from('phyto_warehouses')
      .insert({
        user_id: ownerId,
        name: wh.name,
        location: wh.field_name,
        notes: 'Importado desde Excel',
      })
      .select('id')
      .single()

    if (error || !created) return { ok: false, message: error?.message ?? `Could not create warehouse ${wh.name}` }
    whIdByKey.set(wh.key, String(created.id))
  }

  for (const p of parsed.products) {
    const { data: existing } = await supabase
      .from('phyto_products')
      .select('id')
      .eq('user_id', ownerId)
      .ilike('name', p.name)
      .maybeSingle()

    if (existing) {
      prodIdByKey.set(p.key, String(existing.id))
      await supabase
        .from('phyto_products')
        .update({
          product_type_label: sanitizeProductTypeLabel(p.product_type_label) || p.product_type_label,
          category: p.category,
          unit: p.unit,
          supplier_name: p.supplier_name,
        })
        .eq('id', existing.id)
      continue
    }

    const { data: created, error } = await supabase
      .from('phyto_products')
      .insert({
        user_id: ownerId,
        name: p.name,
        product_type_label: p.product_type_label,
        category: p.category,
        unit: p.unit,
        supplier_name: p.supplier_name,
      })
      .select('id')
      .single()

    if (error || !created) return { ok: false, message: error?.message ?? `Could not create product ${p.name}` }
    prodIdByKey.set(p.key, String(created.id))
  }

  let programId: string | null = null
  if (parsed.programItems.length) {
    const { data: prog, error: pErr } = await supabase
      .from('phyto_application_programs')
      .insert({
        user_id: ownerId,
        name: 'Programa importado',
        field_name: parsed.programItems[0]?.field_name ?? '',
        season_label: new Date().getFullYear().toString(),
        notes: `Importado ${new Date().toISOString().slice(0, 10)}`,
      })
      .select('id')
      .single()
    if (pErr || !prog) return { ok: false, message: pErr?.message ?? 'Could not create program' }
    programId = String(prog.id)
  }

  const movementInserts = parsed.movements
    .filter(m => m.quantity > 0)
    .map(m => ({
      user_id: ownerId,
      warehouse_id: whIdByKey.get(m.warehouse_key) ?? whIdByKey.values().next().value,
      product_id: prodIdByKey.get(m.product_key),
      type: m.type,
      quantity: m.quantity,
      unit: m.unit,
      movement_date: m.movement_date ?? new Date().toISOString().slice(0, 10),
      field_name: m.field_name,
      supplier_name: m.supplier_name,
      unit_price: m.unit_price,
      total_clp: m.total_clp,
      product_type_label: m.product_type_label,
      reference: 'Import Excel',
    }))
    .filter(m => m.warehouse_id && m.product_id)

  if (movementInserts.length) {
    const { error } = await supabase.from('phyto_movements').insert(movementInserts)
    if (error) return { ok: false, message: error.message }
  }

  const invoiceInserts = parsed.invoices.map(inv => ({
    user_id: ownerId,
    invoice_number: inv.invoice_number,
    supplier_name: inv.supplier_name,
    client_name: inv.client_name,
    field_name: inv.field_name,
    warehouse_id: whIdByKey.get(inv.warehouse_key) ?? null,
    product_id: prodIdByKey.get(inv.product_key) ?? null,
    issue_date: inv.issue_date,
    month_label: inv.month_label,
    product_name: inv.product_name,
    quantity: inv.quantity,
    unit: inv.unit,
    unit_price: inv.unit_price,
    net_amount: inv.net_amount,
    tax_amount: inv.tax_amount,
    total_clp: inv.total_clp,
    product_type_label: inv.product_type_label,
  }))

  if (invoiceInserts.length) {
    const { error } = await supabase.from('phyto_purchase_invoices').insert(invoiceInserts)
    if (error) return { ok: false, message: error.message }
  }

  if (programId) {
    const inferred = inferProgramDateRange(parsed.programItems)
    await supabase
      .from('phyto_application_programs')
      .update({ start_date: inferred.start_date, end_date: inferred.end_date })
      .eq('id', programId)

    const itemInserts = parsed.programItems.map((item, idx) => ({
      program_id: programId,
      user_id: ownerId,
      month_label: item.month_label,
      stage_label: item.stage_label,
      application_date: item.application_date,
      application_end_date: item.application_end_date ?? inferred.end_date ?? item.application_date,
      field_name: item.field_name,
      product_id: prodIdByKey.get(item.product_key) ?? null,
      product_name: item.product_name,
      dose_label: item.dose_label,
      spray_volume_l_ha: item.spray_volume_l_ha,
      application_area_label: item.application_area_label,
      status: item.status,
      surface_ha: item.surface_ha,
      total_required: item.total_required,
      total_applied: item.total_applied,
      unit: item.unit,
      sort_order: idx,
    }))
    const { error } = await supabase.from('phyto_application_items').insert(itemInserts)
    if (error) return { ok: false, message: error.message }
  }

  const containerInserts = parsed.containers
    .map(c => ({
      user_id: ownerId,
      warehouse_id: whIdByKey.get(c.warehouse_key),
      product_id: prodIdByKey.get(c.product_key),
      container_count: c.container_count,
      pack_size_label: c.pack_size_label,
      open_count: c.open_count,
    }))
    .filter(c => c.warehouse_id && c.product_id)

  if (containerInserts.length) {
    const { error } = await supabase.from('phyto_warehouse_containers').insert(containerInserts)
    if (error) return { ok: false, message: error.message }
  }

  await syncPhytoProductCategoriesAction()

  revalidateAll()
  return { ok: true, summary: summarizeParsedWorkbook(parsed) }
}

export async function listPhytoMovementsFullAction(limit = 500): Promise<
  { ok: true; data: import('@/lib/fitosanitario/types').PhytoMovement[] } | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('phyto_movements')
    .select('*, warehouse:warehouse_id (id, name), product:product_id (id, name, category, unit, product_type_label)')
    .eq('user_id', ownerId)
    .order('movement_date', { ascending: false })
    .limit(limit)

  if (error) return { ok: false, message: error.message }

  const mapMovement = (row: Record<string, unknown>) => {
    const warehouse = row.warehouse as Record<string, unknown> | null | undefined
    const product = row.product as Record<string, unknown> | null | undefined
    return {
      id: String(row.id),
      user_id: String(row.user_id),
      warehouse_id: String(row.warehouse_id),
      product_id: String(row.product_id),
      type: String(row.type) as 'entrada' | 'salida' | 'ajuste',
      quantity: Number(row.quantity) || 0,
      unit: String(row.unit ?? 'L'),
      lot_number: String(row.lot_number ?? ''),
      expiry_date: row.expiry_date != null ? String(row.expiry_date) : null,
      reference: String(row.reference ?? ''),
      notes: String(row.notes ?? ''),
      movement_date: String(row.movement_date ?? ''),
      supplier_name: String(row.supplier_name ?? ''),
      field_name: String(row.field_name ?? ''),
      unit_price: row.unit_price != null ? Number(row.unit_price) : null,
      total_clp: row.total_clp != null ? Number(row.total_clp) : null,
      product_type_label: String(row.product_type_label ?? ''),
      application_item_id: row.application_item_id != null ? String(row.application_item_id) : null,
      created_at: String(row.created_at ?? ''),
      warehouse: warehouse ? { id: String(warehouse.id), name: String(warehouse.name ?? '') } : undefined,
      product: product
        ? {
            id: String(product.id),
            name: String(product.name ?? ''),
            category: String(product.category ?? 'other') as PhytoProduct['category'],
            unit: String(product.unit ?? 'L'),
            product_type_label: String(product.product_type_label ?? ''),
          }
        : undefined,
    }
  }

  return { ok: true, data: (data ?? []).map(r => mapMovement(r as Record<string, unknown>)) }
}

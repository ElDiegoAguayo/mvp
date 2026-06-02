'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getDataOwnerId } from '@/lib/supabase/effective-user-server'
import { buildStockRows, computeStockFromMovements } from '@/lib/fitosanitario/stock'
import { categoryFromProductTypeLabel, sanitizeProductTypeLabel } from '@/lib/fitosanitario/categories'
import type {
  HarvestFieldOption,
  PhytoMovement,
  PhytoMovementType,
  PhytoProduct,
  PhytoProductCategory,
  PhytoStockRow,
  PhytoWarehouse,
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

function revalidateFitosanitario() {
  for (const p of REVALIDATE_PATHS) revalidatePath(p)
}

async function requireOwnerId(): Promise<string | null> {
  const supabase = await createClient()
  return getDataOwnerId(supabase)
}

function mapWarehouse(row: Record<string, unknown>): PhytoWarehouse {
  const field = row.field as Record<string, unknown> | null | undefined
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    field_id: row.field_id != null ? String(row.field_id) : null,
    name: String(row.name ?? ''),
    location: String(row.location ?? ''),
    notes: String(row.notes ?? ''),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    field: field
      ? { id: String(field.id), name: String(field.name ?? '') }
      : null,
  }
}

function mapProduct(row: Record<string, unknown>): PhytoProduct {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name ?? ''),
    brand: String(row.brand ?? ''),
    supplier_name: String(row.supplier_name ?? ''),
    category: String(row.category ?? 'other') as PhytoProductCategory,
    product_type_label: String(row.product_type_label ?? ''),
    target_label: String(row.target_label ?? ''),
    active_ingredient: String(row.active_ingredient ?? ''),
    unit: String(row.unit ?? 'L'),
    min_stock: row.min_stock != null ? Number(row.min_stock) : null,
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

function mapMovement(row: Record<string, unknown>): PhytoMovement {
  const warehouse = row.warehouse as Record<string, unknown> | null | undefined
  const product = row.product as Record<string, unknown> | null | undefined
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    warehouse_id: String(row.warehouse_id),
    product_id: String(row.product_id),
    type: String(row.type) as PhytoMovementType,
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
    warehouse: warehouse
      ? { id: String(warehouse.id), name: String(warehouse.name ?? '') }
      : undefined,
    product: product
      ? {
          id: String(product.id),
          name: String(product.name ?? ''),
          category: String(product.category ?? 'other') as PhytoProductCategory,
          unit: String(product.unit ?? 'L'),
          product_type_label: String(product.product_type_label ?? ''),
        }
      : undefined,
  }
}

export async function listHarvestFieldsAction(): Promise<
  { ok: true; data: HarvestFieldOption[] } | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('harvest_fields')
    .select('id, name')
    .eq('user_id', ownerId)
    .order('name')

  if (error) return { ok: false, message: error.message }
  return {
    ok: true,
    data: (data ?? []).map(r => ({ id: String(r.id), name: String(r.name) })),
  }
}

export async function listPhytoWarehousesAction(): Promise<
  { ok: true; data: PhytoWarehouse[] } | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('phyto_warehouses')
    .select('*, field:field_id (id, name)')
    .eq('user_id', ownerId)
    .order('name')

  if (error) return { ok: false, message: error.message }
  return { ok: true, data: (data ?? []).map(r => mapWarehouse(r as Record<string, unknown>)) }
}

export async function savePhytoWarehouseAction(input: {
  id?: string
  field_id?: string | null
  name: string
  location?: string
  notes?: string
  is_active?: boolean
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }
  if (!input.name.trim()) return { ok: false, message: 'Warehouse name is required' }

  const supabase = await createClient()
  const payload = {
    user_id: ownerId,
    field_id: input.field_id || null,
    name: input.name.trim(),
    location: input.location?.trim() ?? '',
    notes: input.notes?.trim() ?? '',
    is_active: input.is_active ?? true,
  }

  if (input.id) {
    const { error } = await supabase
      .from('phyto_warehouses')
      .update(payload)
      .eq('id', input.id)
      .eq('user_id', ownerId)
    if (error) return { ok: false, message: error.message }
    revalidateFitosanitario()
    return { ok: true, id: input.id }
  }

  const { data, error } = await supabase
    .from('phyto_warehouses')
    .insert(payload)
    .select('id')
    .single()

  if (error || !data) return { ok: false, message: error?.message ?? 'Could not save warehouse' }
  revalidateFitosanitario()
  return { ok: true, id: String(data.id) }
}

export async function deletePhytoWarehouseAction(id: string): Promise<{ ok: boolean; message?: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { count } = await supabase
    .from('phyto_movements')
    .select('id', { count: 'exact', head: true })
    .eq('warehouse_id', id)
    .eq('user_id', ownerId)

  if ((count ?? 0) > 0) {
    return { ok: false, message: 'Cannot delete a warehouse with movement history' }
  }

  const { error } = await supabase
    .from('phyto_warehouses')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId)

  if (error) return { ok: false, message: error.message }
  revalidateFitosanitario()
  return { ok: true }
}

export async function listPhytoProductsAction(): Promise<
  { ok: true; data: PhytoProduct[] } | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('phyto_products')
    .select('*')
    .eq('user_id', ownerId)
    .order('name')

  if (error) return { ok: false, message: error.message }
  return { ok: true, data: (data ?? []).map(r => mapProduct(r as Record<string, unknown>)) }
}

export async function savePhytoProductAction(input: {
  id?: string
  name: string
  brand?: string
  supplier_name?: string
  category?: PhytoProductCategory
  product_type_label?: string
  target_label?: string
  active_ingredient?: string
  unit?: string
  min_stock?: number | null
  is_active?: boolean
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }
  if (!input.name.trim()) return { ok: false, message: 'Product name is required' }

  const supabase = await createClient()
  const product_type_label = sanitizeProductTypeLabel(input.product_type_label?.trim() ?? '')
  const category = product_type_label
    ? categoryFromProductTypeLabel(product_type_label)
    : (input.category ?? 'other')
  const payload = {
    user_id: ownerId,
    name: input.name.trim(),
    brand: input.brand?.trim() ?? '',
    supplier_name: input.supplier_name?.trim() ?? '',
    category,
    product_type_label,
    target_label: input.target_label?.trim() ?? '',
    active_ingredient: input.active_ingredient?.trim() ?? '',
    unit: input.unit?.trim() || 'L',
    min_stock: input.min_stock ?? null,
    is_active: input.is_active ?? true,
  }

  if (input.id) {
    const { error } = await supabase
      .from('phyto_products')
      .update(payload)
      .eq('id', input.id)
      .eq('user_id', ownerId)
    if (error) return { ok: false, message: error.message }
    revalidateFitosanitario()
    return { ok: true, id: input.id }
  }

  const { data, error } = await supabase
    .from('phyto_products')
    .insert(payload)
    .select('id')
    .single()

  if (error || !data) return { ok: false, message: error?.message ?? 'Could not save product' }
  revalidateFitosanitario()
  return { ok: true, id: String(data.id) }
}

export async function deletePhytoProductAction(id: string): Promise<{ ok: boolean; message?: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { count } = await supabase
    .from('phyto_movements')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', id)
    .eq('user_id', ownerId)

  if ((count ?? 0) > 0) {
    return { ok: false, message: 'Cannot delete a product with movement history' }
  }

  const { error } = await supabase
    .from('phyto_products')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId)

  if (error) return { ok: false, message: error.message }
  revalidateFitosanitario()
  return { ok: true }
}

export async function listPhytoMovementsAction(limit = 50): Promise<
  { ok: true; data: PhytoMovement[] } | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('phyto_movements')
    .select('*, warehouse:warehouse_id (id, name), product:product_id (id, name, category, unit)')
    .eq('user_id', ownerId)
    .order('movement_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { ok: false, message: error.message }
  return { ok: true, data: (data ?? []).map(r => mapMovement(r as Record<string, unknown>)) }
}

export async function registerPhytoMovementAction(input: {
  warehouse_id: string
  product_id: string
  type: PhytoMovementType
  quantity: number
  unit?: string
  lot_number?: string
  expiry_date?: string | null
  reference?: string
  notes?: string
  movement_date?: string
  supplier_name?: string
  field_name?: string
  unit_price?: number | null
  total_clp?: number | null
  product_type_label?: string
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const quantity = Number(input.quantity)
  if (!input.warehouse_id || !input.product_id) return { ok: false, message: 'Warehouse and product are required' }
  if (!quantity || quantity <= 0) return { ok: false, message: 'Quantity must be greater than zero' }

  const supabase = await createClient()

  if (input.type === 'salida') {
    const { data: movements } = await supabase
      .from('phyto_movements')
      .select('warehouse_id, product_id, type, quantity')
      .eq('user_id', ownerId)
      .eq('warehouse_id', input.warehouse_id)
      .eq('product_id', input.product_id)

    const stockMap = computeStockFromMovements((movements ?? []) as PhytoMovement[])
    const key = `${input.warehouse_id}:${input.product_id}`
    const current = stockMap.get(key) ?? 0
    if (current < quantity) {
      return { ok: false, message: `Insufficient stock (available: ${current})` }
    }
  }

  const { data, error } = await supabase
    .from('phyto_movements')
    .insert({
      user_id: ownerId,
      warehouse_id: input.warehouse_id,
      product_id: input.product_id,
      type: input.type,
      quantity,
      unit: input.unit?.trim() || 'L',
      lot_number: input.lot_number?.trim() ?? '',
      expiry_date: input.expiry_date || null,
      reference: input.reference?.trim() ?? '',
      notes: input.notes?.trim() ?? '',
      movement_date: input.movement_date || new Date().toISOString().slice(0, 10),
      supplier_name: input.supplier_name?.trim() ?? '',
      field_name: input.field_name?.trim() ?? '',
      unit_price: input.unit_price ?? null,
      total_clp: input.total_clp ?? null,
      product_type_label: input.product_type_label?.trim() ?? '',
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, message: error?.message ?? 'Could not register movement' }
  revalidateFitosanitario()
  return { ok: true, id: String(data.id) }
}

async function syncPhytoProductCategoriesForUser(ownerId: string): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('phyto_products')
    .select('id, product_type_label, category')
    .eq('user_id', ownerId)

  let updated = 0
  for (const row of data ?? []) {
    const label = sanitizeProductTypeLabel(String(row.product_type_label ?? ''))
    if (!label) continue
    const next = categoryFromProductTypeLabel(label)
    if (next !== row.category) {
      await supabase.from('phyto_products').update({ category: next }).eq('id', row.id)
      updated++
    }
  }
  return updated
}

export async function syncPhytoProductCategoriesAction(): Promise<
  { ok: true; updated: number } | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }
  const updated = await syncPhytoProductCategoriesForUser(ownerId)
  if (updated > 0) revalidateFitosanitario()
  return { ok: true, updated }
}

export async function listPhytoStockAction(): Promise<
  { ok: true; data: PhytoStockRow[]; movements: PhytoMovement[] } | { ok: false; message: string }
> {
  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  await syncPhytoProductCategoriesForUser(ownerId)

  const supabase = await createClient()
  const [wRes, pRes, mRes] = await Promise.all([
    supabase.from('phyto_warehouses').select('*').eq('user_id', ownerId),
    supabase.from('phyto_products').select('*').eq('user_id', ownerId),
    supabase.from('phyto_movements').select('*').eq('user_id', ownerId),
  ])

  if (wRes.error) return { ok: false, message: wRes.error.message }
  if (pRes.error) return { ok: false, message: pRes.error.message }
  if (mRes.error) return { ok: false, message: mRes.error.message }

  const warehouses = (wRes.data ?? []).map(r => mapWarehouse(r as Record<string, unknown>))
  const products = (pRes.data ?? []).map(r => mapProduct(r as Record<string, unknown>))
  const movements = (mRes.data ?? []).map(r => mapMovement(r as Record<string, unknown>))

  return {
    ok: true,
    data: buildStockRows({ warehouses, products, movements }),
    movements,
  }
}

export async function getPhytoDashboardStatsAction(): Promise<
  | { ok: true; stats: { warehouses: number; products: number; lowStock: number; movements30d: number } }
  | { ok: false; message: string }
> {
  const stockRes = await listPhytoStockAction()
  if (!stockRes.ok) return stockRes

  const ownerId = await requireOwnerId()
  if (!ownerId) return { ok: false, message: 'Unauthorized' }

  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceIso = since.toISOString().slice(0, 10)

  const { count } = await supabase
    .from('phyto_movements')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ownerId)
    .gte('movement_date', sinceIso)

  const warehouses = new Set(stockRes.data.map(r => r.warehouse_id)).size
  const products = new Set(stockRes.data.map(r => r.product_id)).size
  const lowStock = stockRes.data.filter(r =>
    r.min_stock != null && r.stock < r.min_stock,
  ).length

  return {
    ok: true,
    stats: {
      warehouses,
      products,
      lowStock,
      movements30d: count ?? 0,
    },
  }
}

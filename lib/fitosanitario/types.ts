export type PhytoProductCategory =
  | 'herbicide'
  | 'insecticide'
  | 'fungicide'
  | 'fertilizer'
  | 'adjuvant'
  | 'biostimulant'
  | 'seed'
  | 'regulator'
  | 'acaricide'
  | 'other'

export type PhytoMovementType = 'entrada' | 'salida' | 'ajuste'

export type PhytoApplicationStatus = 'planned' | 'applied' | 'cancelled'

export interface PhytoWarehouse {
  id: string
  user_id: string
  field_id: string | null
  name: string
  location: string
  notes: string
  is_active: boolean
  created_at: string
  updated_at: string
  field?: { id: string; name: string } | null
}

export interface PhytoProduct {
  id: string
  user_id: string
  name: string
  brand: string
  supplier_name: string
  category: PhytoProductCategory
  product_type_label: string
  target_label: string
  active_ingredient: string
  unit: string
  min_stock: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PhytoMovement {
  id: string
  user_id: string
  warehouse_id: string
  product_id: string
  type: PhytoMovementType
  quantity: number
  unit: string
  lot_number: string
  expiry_date: string | null
  reference: string
  notes: string
  movement_date: string
  supplier_name: string
  field_name: string
  unit_price: number | null
  total_clp: number | null
  product_type_label: string
  application_item_id: string | null
  created_at: string
  warehouse?: Pick<PhytoWarehouse, 'id' | 'name'>
  product?: Pick<PhytoProduct, 'id' | 'name' | 'category' | 'unit' | 'product_type_label'>
}

export interface PhytoStockRow {
  warehouse_id: string
  product_id: string
  warehouse_name: string
  product_name: string
  field_name: string
  category: PhytoProductCategory
  product_type_label: string
  unit: string
  stock: number
  entries_total: number
  exits_total: number
  min_stock: number | null
  supplier_name: string
  last_movement_date: string | null
  month_label: string
}

export interface PhytoWarehouseContainer {
  id: string
  warehouse_id: string
  product_id: string
  container_count: number
  pack_size_label: string
  open_count: number
  notes: string
  warehouse?: Pick<PhytoWarehouse, 'id' | 'name'>
  product?: Pick<PhytoProduct, 'id' | 'name' | 'product_type_label' | 'unit'>
}

export interface PhytoApplicationProgram {
  id: string
  name: string
  field_name: string
  season_label: string
  start_date: string | null
  end_date: string | null
  notes: string
  created_at: string
  updated_at: string
}

export interface PhytoApplicationItem {
  id: string
  program_id: string
  month_label: string
  stage_label: string
  application_date: string | null
  application_end_date: string | null
  field_name: string
  product_id: string | null
  product_name: string
  dose_label: string
  spray_volume_l_ha: number | null
  application_area_label: string
  status: PhytoApplicationStatus
  surface_ha: number | null
  total_required: number | null
  total_applied: number | null
  unit: string
  target_label: string
  sort_order: number
}

export interface PhytoPurchaseInvoice {
  id: string
  invoice_number: string
  supplier_name: string
  client_name: string
  field_name: string
  warehouse_id: string | null
  product_id: string | null
  issue_date: string | null
  month_label: string
  product_name: string
  quantity: number
  unit: string
  unit_price: number | null
  net_amount: number | null
  tax_amount: number | null
  total_clp: number | null
  product_type_label: string
  movement_id: string | null
}

export interface HarvestFieldOption {
  id: string
  name: string
}

export interface PhytoImportSummary {
  warehouses: number
  products: number
  movements: number
  invoices: number
  programItems: number
  containers: number
}

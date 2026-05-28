// Tipos para el módulo de Planificación de Producción / Embalaje

export interface InventarioMaterial {
  id: string
  cliente_id: string
  codigo_material: string
  descripcion: string
  stock_actual: number
  unidad_medida: string
  es_por_pallet: boolean
  updated_at: string
}

export interface RecetaEmbalaje {
  id: string
  cliente_id: string
  codigo_receta: string
  descripcion: string | null
  variedad: string | null
  cajas_por_pallet: number | null
  is_active: boolean
  created_at: string
}

export interface RecetaDetalle {
  id: string
  receta_id: string
  material_id: string
  cantidad_requerida: number
}

export type EstadoAlerta = 'critico' | 'bajo' | 'ok'

export interface MaterialLimitante {
  codigo: string
  descripcion: string
  stock_actual: number
  unidad_medida: string
  necesario_por_caja: number
  capacidad_aportada: number
}

export interface CapacidadReceta {
  codigo_receta: string
  descripcion: string | null
  variedad: string | null
  cajas_por_pallet: number | null
  capacidad_maxima: number
  capacidad_pallets: number
  material_limitante: string
  material_limitante_stock: number
  material_limitante_unidad: string
  estado_alerta: EstadoAlerta
  detalle_materiales: MaterialLimitante[]
}

export interface ImportResult {
  ok: boolean
  materiales_creados: number
  recetas_creadas: number
  detalles_creados: number
  message?: string
}

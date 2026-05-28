// Registry of native Supabase tables per module slug.
// Importable from both client and server files (no 'use server').

export interface NativeTableDef {
  tabla: string
  label: string
  col_codigo: string
  col_nombre: string
  cols_extra: string[]
  col_filter: string
}

export const NATIVE_MODULES: Record<string, NativeTableDef[]> = {
  inventario: [
    {
      tabla: 'inventory_materials',
      label: 'Materiales de Inventario',
      col_codigo: 'sku',
      col_nombre: 'name',
      cols_extra: ['unit'],
      col_filter: 'user_id',
    },
    {
      tabla: 'inventory_warehouses',
      label: 'Bodegas',
      col_codigo: 'name',
      col_nombre: 'location',
      cols_extra: [],
      col_filter: 'user_id',
    },
  ],
}

/** Allowed native table names (whitelist for security) */
export const ALLOWED_NATIVE_TABLES = new Set(
  Object.values(NATIVE_MODULES).flat().map((d) => d.tabla),
)

/** Find native table defs by module slug */
export function getNativeDefsForSlug(slug: string): NativeTableDef[] {
  const s = slug.toLowerCase()
  for (const [key, defs] of Object.entries(NATIVE_MODULES)) {
    if (s.includes(key)) return defs
  }
  return []
}

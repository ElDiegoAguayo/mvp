'use server'

import { createClient } from '@/lib/supabase/server'
import { getEffectiveUserId } from '@/lib/supabase/effective-user-server'
import type {
  CapacidadReceta,
  EstadoAlerta,
  ImportResult,
  MaterialLimitante,
} from '@/types/produccion'

// ─── Thresholds (adjust here) ─────────────────────────────────────────────────
const UMBRAL_CRITICO_PALLETS = 10
const UMBRAL_BAJO_PALLETS    = 50

// ─── Name normalization for fuzzy matching ────────────────────────────────────
// Handles differences like "PAPEL SULFITO BLANCO 45X50 " vs
// "PAPEL SULFITO BLANCO 45X50 (KG)" between the two Excel sheets.
function normalizarNombreMaterial(name: string): string {
  return name
    .toUpperCase()
    .trim()
    // Remove unit suffixes in parentheses: (KG), (METROS), (GR), etc.
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
}

/** Looks up stock by exact name first, then by normalized name */
function buscarStock(stockMap: Map<string, number>, nombre: string): number {
  // 1. Exact match
  if (stockMap.has(nombre)) return stockMap.get(nombre)!
  // 2. Normalized match
  const normBuscar = normalizarNombreMaterial(nombre)
  for (const [key, val] of stockMap.entries()) {
    if (normalizarNombreMaterial(key) === normBuscar) return val
  }
  // 3. Partial match: one contains the other (normalized)
  for (const [key, val] of stockMap.entries()) {
    const normKey = normalizarNombreMaterial(key)
    if (normKey.includes(normBuscar) || normBuscar.includes(normKey)) return val
  }
  return 0
}

// ─────────────────────────────────────────────────────────────────────────────
// calcularCapacidadPorReceta
// Crosses receta_detalles + inventario_materiales to find max producible
// boxes for every active packing code belonging to the client.
// ─────────────────────────────────────────────────────────────────────────────

export async function calcularCapacidadPorReceta(
  clienteId: string,
): Promise<{ ok: boolean; data: CapacidadReceta[]; message?: string }> {
  const supabase = await createClient()
  const { effectiveUserId } = await getEffectiveUserId(supabase)
  if (!effectiveUserId) return { ok: false, data: [], message: 'Sesión expirada.' }

  // 1. Fetch all active recipes for the client
  const { data: recetas, error: errR } = await supabase
    .from('recetas_embalaje')
    .select('id, codigo_receta, descripcion, variedad, cajas_por_pallet')
    .eq('cliente_id', clienteId)
    .eq('is_active', true)
    .order('codigo_receta', { ascending: true })

  if (errR) return { ok: false, data: [], message: errR.message }
  if (!recetas?.length) return { ok: true, data: [], message: 'No hay recetas configuradas.' }

  // 2. Fetch all materials with stock for the client
  const { data: materiales, error: errM } = await supabase
    .from('inventario_materiales')
    .select('id, codigo_material, descripcion, stock_actual, unidad_medida, es_por_pallet')
    .eq('cliente_id', clienteId)

  if (errM) return { ok: false, data: [], message: errM.message }

  const materialMap = new Map(
    (materiales ?? []).map((m) => [m.id, m]),
  )

  // 3. Fetch all receta_detalles for these recipes in one query
  const recetaIds = recetas.map((r) => r.id)
  const { data: detalles, error: errD } = await supabase
    .from('receta_detalles')
    .select('receta_id, material_id, cantidad_requerida')
    .in('receta_id', recetaIds)

  if (errD) return { ok: false, data: [], message: errD.message }

  // Group detalles by receta_id
  const detallesByReceta = new Map<string, typeof detalles>()
  for (const d of detalles ?? []) {
    const list = detallesByReceta.get(d.receta_id) ?? []
    list.push(d)
    detallesByReceta.set(d.receta_id, list)
  }

  // 4. Calculate capacity per recipe
  const result: CapacidadReceta[] = recetas.map((receta) => {
    const lines = detallesByReceta.get(receta.id) ?? []
    const cajasXPallet = receta.cajas_por_pallet ?? 1

    if (!lines.length) {
      return {
        codigo_receta:              receta.codigo_receta,
        descripcion:                receta.descripcion,
        variedad:                   receta.variedad,
        cajas_por_pallet:           receta.cajas_por_pallet,
        capacidad_maxima:           0,
        capacidad_pallets:          0,
        material_limitante:         'Sin materiales configurados',
        material_limitante_stock:   0,
        material_limitante_unidad:  '',
        estado_alerta:              'critico' as EstadoAlerta,
        detalle_materiales:         [],
      }
    }

    // Build ratio list: stock / cantidad_requerida per material
    const ratios: MaterialLimitante[] = []
    for (const line of lines) {
      const mat = materialMap.get(line.material_id)
      if (!mat) continue

      // If material is per-pallet, convert stock to per-box equivalent
      const stockPorCaja = mat.es_por_pallet
        ? mat.stock_actual * cajasXPallet
        : mat.stock_actual

      const capacidadAportada = line.cantidad_requerida > 0
        ? Math.floor(stockPorCaja / line.cantidad_requerida)
        : Infinity

      ratios.push({
        codigo:               mat.codigo_material,
        descripcion:          mat.descripcion,
        stock_actual:         mat.stock_actual,
        unidad_medida:        mat.unidad_medida,
        necesario_por_caja:   Number(line.cantidad_requerida),
        capacidad_aportada:   capacidadAportada === Infinity ? 999999 : capacidadAportada,
      })
    }

    // Sort ascending by capacity — the first entry is the bottleneck
    ratios.sort((a, b) => a.capacidad_aportada - b.capacidad_aportada)

    const limitante = ratios[0]
    const capacidad_maxima  = limitante?.capacidad_aportada ?? 0
    const capacidad_pallets = cajasXPallet > 0 ? Math.floor(capacidad_maxima / cajasXPallet) : 0

    let estado_alerta: EstadoAlerta = 'ok'
    if (capacidad_pallets < UMBRAL_CRITICO_PALLETS) estado_alerta = 'critico'
    else if (capacidad_pallets < UMBRAL_BAJO_PALLETS) estado_alerta = 'bajo'

    return {
      codigo_receta:             receta.codigo_receta,
      descripcion:               receta.descripcion,
      variedad:                  receta.variedad,
      cajas_por_pallet:          receta.cajas_por_pallet,
      capacidad_maxima,
      capacidad_pallets,
      material_limitante:        limitante?.descripcion ?? 'Desconocido',
      material_limitante_stock:  limitante?.stock_actual ?? 0,
      material_limitante_unidad: limitante?.unidad_medida ?? '',
      estado_alerta,
      detalle_materiales:        ratios,
    }
  })

  // Sort: critico first, then bajo, then ok, then by code
  const order: Record<EstadoAlerta, number> = { critico: 0, bajo: 1, ok: 2 }
  result.sort((a, b) => {
    const diff = order[a.estado_alerta] - order[b.estado_alerta]
    return diff !== 0 ? diff : a.codigo_receta.localeCompare(b.codigo_receta)
  })

  return { ok: true, data: result }
}

// ─────────────────────────────────────────────────────────────────────────────
// importarExcelProduccion
// Parses the "CODIGOS EMBALAJE" + "INVENTARIO" sheets and upserts the data
// into inventario_materiales, recetas_embalaje, and receta_detalles.
// ─────────────────────────────────────────────────────────────────────────────

export async function importarExcelProduccion(
  formData: FormData,
  clienteId: string,
): Promise<ImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, materiales_creados: 0, recetas_creadas: 0, detalles_creados: 0, message: 'No autenticado.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { ok: false, materiales_creados: 0, recetas_creadas: 0, detalles_creados: 0, message: 'Sin permisos de administrador.' }

  const file = formData.get('file') as File | null
  if (!file) return { ok: false, materiales_creados: 0, recetas_creadas: 0, detalles_creados: 0, message: 'No se recibió archivo.' }

  // Dynamically import xlsx (heavy library, server-only)
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })

  // ── Parse CODIGOS EMBALAJE sheet ──────────────────────────────────────────
  const wsRecetas = wb.Sheets['CODIGOS EMBALAJE']
  if (!wsRecetas) return { ok: false, materiales_creados: 0, recetas_creadas: 0, detalles_creados: 0, message: 'Hoja "CODIGOS EMBALAJE" no encontrada.' }

  const rawRecetas = XLSX.utils.sheet_to_json(wsRecetas, { header: 1 }) as (string | number | null)[][]

  const variedadRow    = rawRecetas[2]  // Row index 2: variety headers
  const cajasRow       = rawRecetas[4]  // Row index 4: cajas por pallet
  const codigosRow     = rawRecetas[5]  // Row index 5: ZFR1, ZFA1…
  const materialRows   = rawRecetas.slice(6) // Row index 6+: materials

  // Build recipe metadata from columns 1..N
  interface RecetaMeta { codigo: string; variedad: string; cajas_por_pallet: number }
  const recetasMeta: RecetaMeta[] = []
  for (let col = 1; col < codigosRow.length; col++) {
    const codigo = codigosRow[col]
    if (!codigo) continue
    // Find variety for this column (look back from current col)
    let variedad = ''
    for (let vc = col; vc >= 1; vc--) {
      if (variedadRow[vc] && String(variedadRow[vc]).trim()) {
        variedad = String(variedadRow[vc]).trim()
        break
      }
    }
    recetasMeta.push({
      codigo:           String(codigo).trim(),
      variedad:         variedad,
      cajas_por_pallet: Number(cajasRow[col]) || 0,
    })
  }

  // Extract unique material names (skip empty and notes rows)
  const materialNames: string[] = []
  for (const row of materialRows) {
    const name = row[0]
    if (!name || String(name).startsWith('**')) continue
    materialNames.push(String(name).trim())
  }

  // ── Parse INVENTARIO sheet ────────────────────────────────────────────────
  const wsInventario = wb.Sheets['INVENTARIO']
  const stockMap = new Map<string, number>()
  if (wsInventario) {
    const rawInv = XLSX.utils.sheet_to_json(wsInventario, { header: 1 }) as (string | number | null)[][]
    for (const row of rawInv.slice(2)) { // skip header rows
      if (!row[0] || String(row[0]).startsWith('**')) continue
      const nombre = String(row[0]).trim()
      // Column 3 = Q TOTAL
      const total = Number(row[3]) || 0
      stockMap.set(nombre, total)
    }
  }

  // ── Upsert inventario_materiales ─────────────────────────────────────────
  const matRows = materialNames.map((nombre) => ({
    cliente_id:      clienteId,
    codigo_material: nombre,
    descripcion:     nombre,
    stock_actual:    buscarStock(stockMap, nombre),   // fuzzy match
    unidad_medida:   'unidades',
    es_por_pallet:   false,
    updated_at:      new Date().toISOString(),
  }))

  const { error: errMat } = await supabase
    .from('inventario_materiales')
    .upsert(matRows, { onConflict: 'cliente_id,codigo_material' })

  if (errMat) return { ok: false, materiales_creados: 0, recetas_creadas: 0, detalles_creados: 0, message: `Error materiales: ${errMat.message}` }

  // Reload material ids after upsert
  const { data: matData } = await supabase
    .from('inventario_materiales')
    .select('id, codigo_material')
    .eq('cliente_id', clienteId)

  const matIdMap = new Map((matData ?? []).map((m) => [m.codigo_material, m.id]))

  // ── Upsert recetas_embalaje ──────────────────────────────────────────────
  const recetaRows = recetasMeta.map((r) => ({
    cliente_id:      clienteId,
    codigo_receta:   r.codigo,
    variedad:        r.variedad || null,
    cajas_por_pallet: r.cajas_por_pallet || null,
    is_active:       true,
  }))

  const { error: errRec } = await supabase
    .from('recetas_embalaje')
    .upsert(recetaRows, { onConflict: 'cliente_id,codigo_receta' })

  if (errRec) return { ok: false, materiales_creados: matRows.length, recetas_creadas: 0, detalles_creados: 0, message: `Error recetas: ${errRec.message}` }

  // Reload recipe ids
  const { data: recData } = await supabase
    .from('recetas_embalaje')
    .select('id, codigo_receta')
    .eq('cliente_id', clienteId)

  const recIdMap = new Map((recData ?? []).map((r) => [r.codigo_receta, r.id]))

  // ── Upsert receta_detalles ────────────────────────────────────────────────
  const detalleRows: { receta_id: string; material_id: string; cantidad_requerida: number }[] = []

  for (let ri = 0; ri < recetasMeta.length; ri++) {
    const receta = recetasMeta[ri]
    const recetaId = recIdMap.get(receta.codigo)
    if (!recetaId) continue

    const colIdx = ri + 1 // column in sheet (0 = material name)
    for (let mi = 0; mi < materialRows.length; mi++) {
      const matRow = materialRows[mi]
      const matName = matRow[0] ? String(matRow[0]).trim() : ''
      if (!matName || matName.startsWith('**')) continue

      const qty = matRow[colIdx]
      if (!qty || Number(qty) <= 0) continue

      const matId = matIdMap.get(matName)
      if (!matId) continue

      detalleRows.push({
        receta_id:          recetaId,
        material_id:        matId,
        cantidad_requerida: Number(qty),
      })
    }
  }

  // Delete old detalles first, then insert fresh (simpler than partial upsert)
  const allRecetaIds = [...recIdMap.values()]
  if (allRecetaIds.length > 0) {
    await supabase.from('receta_detalles').delete().in('receta_id', allRecetaIds)
  }

  let detallesCreados = 0
  if (detalleRows.length > 0) {
    // Insert in batches of 500
    for (let i = 0; i < detalleRows.length; i += 500) {
      const batch = detalleRows.slice(i, i + 500)
      const { error: errDet } = await supabase.from('receta_detalles').insert(batch)
      if (errDet) return { ok: false, materiales_creados: matRows.length, recetas_creadas: recetaRows.length, detalles_creados: detallesCreados, message: `Error detalles: ${errDet.message}` }
      detallesCreados += batch.length
    }
  }

  return {
    ok: true,
    materiales_creados: matRows.length,
    recetas_creadas:    recetaRows.length,
    detalles_creados:   detallesCreados,
    message: `Importación completada: ${matRows.length} materiales, ${recetaRows.length} recetas, ${detallesCreados} líneas de BOM.`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// actualizarStockMaterial
// Admin: update stock for a single material.
// ─────────────────────────────────────────────────────────────────────────────

export async function actualizarStockMaterial(
  materialId: string,
  nuevoStock: number,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'No autenticado.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { ok: false, message: 'Sin permisos.' }

  const { error } = await supabase
    .from('inventario_materiales')
    .update({ stock_actual: nuevoStock, updated_at: new Date().toISOString() })
    .eq('id', materialId)

  if (error) return { ok: false, message: error.message }
  return { ok: true, message: 'Stock actualizado.' }
}

// ─────────────────────────────────────────────────────────────────────────────
// obtenerInventario  — list all materials for a client
// ─────────────────────────────────────────────────────────────────────────────

export async function obtenerInventario(clienteId: string) {
  const supabase = await createClient()
  const { effectiveUserId } = await getEffectiveUserId(supabase)
  if (!effectiveUserId) return { ok: false, data: [], message: 'Sesión expirada.' }

  const { data, error } = await supabase
    .from('inventario_materiales')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('descripcion', { ascending: true })

  if (error) return { ok: false, data: [], message: error.message }
  return { ok: true, data: data ?? [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// eliminarMaterial — Admin: delete a material (cascade removes receta_detalles)
// ─────────────────────────────────────────────────────────────────────────────

export async function eliminarMaterial(
  materialId: string,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'No autenticado.' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { ok: false, message: 'Sin permisos.' }

  const { error } = await supabase.from('inventario_materiales').delete().eq('id', materialId)
  if (error) return { ok: false, message: error.message }
  return { ok: true, message: 'Material eliminado.' }
}

// ─────────────────────────────────────────────────────────────────────────────
// actualizarMaterial — Admin: update descripcion and/or stock_actual
// ─────────────────────────────────────────────────────────────────────────────

export async function actualizarMaterial(
  materialId: string,
  campos: { descripcion?: string; stock_actual?: number; unidad_medida?: string },
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'No autenticado.' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { ok: false, message: 'Sin permisos.' }

  const { error } = await supabase
    .from('inventario_materiales')
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq('id', materialId)
  if (error) return { ok: false, message: error.message }
  return { ok: true, message: 'Material actualizado.' }
}

// ─────────────────────────────────────────────────────────────────────────────
// eliminarReceta — Admin: delete a recipe and all its BOM lines (cascade)
// ─────────────────────────────────────────────────────────────────────────────

export async function eliminarReceta(
  recetaId: string,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'No autenticado.' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { ok: false, message: 'Sin permisos.' }

  const { error } = await supabase.from('recetas_embalaje').delete().eq('id', recetaId)
  if (error) return { ok: false, message: error.message }
  return { ok: true, message: 'Receta eliminada.' }
}

// ─────────────────────────────────────────────────────────────────────────────
// RecetaAdmin type + obtenerRecetasAdmin
// Recipes with their full BOM (material names + stock)
// ─────────────────────────────────────────────────────────────────────────────

export interface RecetaAdmin {
  id: string
  codigo_receta: string
  descripcion: string | null
  variedad: string | null
  cajas_por_pallet: number | null
  is_active: boolean
  detalles: Array<{
    id: string
    material_id: string
    descripcion: string
    cantidad_requerida: number
    stock_actual: number
    unidad_medida: string
  }>
}

export async function obtenerRecetasAdmin(
  clienteId: string,
): Promise<{ ok: boolean; data: RecetaAdmin[]; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, data: [], message: 'No autenticado.' }

  const { data: recetas, error: errR } = await supabase
    .from('recetas_embalaje')
    .select('id, codigo_receta, descripcion, variedad, cajas_por_pallet, is_active')
    .eq('cliente_id', clienteId)
    .order('codigo_receta', { ascending: true })
  if (errR) return { ok: false, data: [], message: errR.message }

  if (!recetas?.length) return { ok: true, data: [] }

  const recetaIds = recetas.map((r) => r.id)
  const { data: detalles, error: errD } = await supabase
    .from('receta_detalles')
    .select('id, receta_id, material_id, cantidad_requerida, inventario_materiales(descripcion, stock_actual, unidad_medida)')
    .in('receta_id', recetaIds)
  if (errD) return { ok: false, data: [], message: errD.message }

  const detalleMap = new Map<string, RecetaAdmin['detalles']>()
  for (const d of detalles ?? []) {
    const mat = d.inventario_materiales as { descripcion: string; stock_actual: number; unidad_medida: string } | null
    const list = detalleMap.get(d.receta_id) ?? []
    list.push({
      id:                 d.id,
      material_id:        d.material_id,
      descripcion:        mat?.descripcion ?? d.material_id,
      cantidad_requerida: Number(d.cantidad_requerida),
      stock_actual:       mat?.stock_actual ?? 0,
      unidad_medida:      mat?.unidad_medida ?? '',
    })
    detalleMap.set(d.receta_id, list)
  }

  const result: RecetaAdmin[] = recetas.map((r) => ({
    ...r,
    detalles: detalleMap.get(r.id) ?? [],
  }))

  return { ok: true, data: result }
}

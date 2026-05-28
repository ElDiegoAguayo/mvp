'use server'

import { createClient } from '@/lib/supabase/server'
import { getEffectiveUserId } from '@/lib/supabase/effective-user-server'
import type { EntidadTipo } from './asignaciones'
import { fetchFilasParaAsignaciones } from './centros-costo'

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Dynamic cost center summary (for entidad_tipo = 'dinamico')
// ─────────────────────────────────────────────────────────────────────────────

export interface EntidadDinamica {
  /** Label of the module (from metadata.label, e.g. "Contenedores") */
  modulo_label: string
  /** Unique code of the assigned record */
  entidad_id: string
  /** Human name of the record (from metadata.nombre) */
  entidad_nombre: string
  /** Number of distinct invoices contributing to this entity */
  num_facturas: number
  /** Sum of monto_asignado for this entity */
  total_gastos: number
  /** Individual invoice detail */
  facturas: {
    factura_id: string
    numero_documento: string
    tipo_documento: string
    fecha_emision: string
    razon_social: string
    monto_bruto: number
    monto_asignado: number
  }[]
  /** Admin-configured extra column names (from metadata.cols_extra) */
  extra_cols: string[]
  /** Full row data keyed by column name (from metadata.data) */
  extra_data: Record<string, unknown>
}

export interface ModuloDinamico {
  label: string
  total_gastos: number
  entidades: EntidadDinamica[]
  /** Admin-configured extra column names for this module */
  cols_extra: string[]
}

export interface ResumenCentrosCosto {
  ok: boolean
  total_gastos: number
  modulos: ModuloDinamico[]
  message?: string
}

export async function obtenerResumenCentrosCosto(
  clienteId: string,
): Promise<ResumenCentrosCosto> {
  const EMPTY: ResumenCentrosCosto = { ok: false, total_gastos: 0, modulos: [] }

  if (!clienteId?.trim()) return { ...EMPTY, message: 'cliente_id requerido.' }

  const supabase = await createClient()
  const { effectiveUserId } = await getEffectiveUserId(supabase)
  if (!effectiveUserId) return { ...EMPTY, message: 'Sesión expirada.' }
  if (clienteId !== effectiveUserId) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', effectiveUserId).single()
    if (profile?.role !== 'admin') return { ...EMPTY, message: 'Sin permisos.' }
  }

  // Diagnostic: count ALL asignaciones for this client (any type)
  const { data: allRows, error: allError } = await supabase
    .from('asignaciones_gastos')
    .select('factura_id, entidad_id, monto_asignado, metadata, entidad_tipo')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })

  if (allError) return { ...EMPTY, message: `Error BD: ${allError.message}` }

  if (!allRows?.length) {
    return { ...EMPTY, ok: true, total_gastos: 0, modulos: [], message: 'DEBUG: 0 asignaciones en BD para este cliente.' }
  }

  // Filter to dinamico type
  const rows = allRows.filter((r) => r.entidad_tipo === 'dinamico')

  if (!rows.length) {
    const tipos = [...new Set(allRows.map((r) => r.entidad_tipo))].join(', ')
    return { ...EMPTY, ok: true, total_gastos: 0, modulos: [], message: `DEBUG: Hay ${allRows.length} asignaciones pero tipo="${tipos}" (esperaba "dinamico"). Verifica que guardaste usando el panel de Asignar.` }
  }

  // Fetch invoice details in a separate query (safer than FK join)
  const facturaIds = [...new Set(rows.map((r) => r.factura_id))]
  const { data: facturas } = await supabase
    .from('registro_compras_sii')
    .select('id, numero_documento, tipo_documento, fecha_emision, razon_social, monto_bruto')
    .in('id', facturaIds)

  type FacturaDetalle = {
    numero_documento: string
    tipo_documento: string
    fecha_emision: string
    razon_social: string
    monto_bruto: number
  }
  const facturaMap = new Map<string, FacturaDetalle>(
    (facturas ?? []).map((f) => [
      f.id,
      {
        numero_documento: f.numero_documento ?? '—',
        tipo_documento:   f.tipo_documento   ?? '—',
        fecha_emision:    f.fecha_emision     ?? '—',
        razon_social:     f.razon_social      ?? '—',
        monto_bruto:      Number(f.monto_bruto ?? 0),
      },
    ]),
  )

  // Group by (modulo_label, entidad_id)
  type Key = string
  const map = new Map<Key, EntidadDinamica>()

  for (const row of rows) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>
    const moduloLabel = String(meta.label ?? 'Sin módulo')
    const entidadNombre = String(meta.nombre ?? '')
    const key: Key = `${moduloLabel}||${row.entidad_id}`

    const colsExtraStr = String(meta.cols_extra ?? '')
    const extraCols    = colsExtraStr ? colsExtraStr.split(',').map((c) => c.trim()).filter(Boolean) : []
    const extraData    = (meta.data ?? {}) as Record<string, unknown>

    const entry = map.get(key) ?? {
      modulo_label: moduloLabel,
      entidad_id: row.entidad_id,
      entidad_nombre: entidadNombre,
      num_facturas: 0,
      total_gastos: 0,
      facturas: [],
      extra_cols: extraCols,
      extra_data: extraData,
    }

    // Keep extra_cols if not already set (use first available)
    if (entry.extra_cols.length === 0 && extraCols.length > 0) {
      entry.extra_cols = extraCols
      entry.extra_data = extraData
    }

    entry.total_gastos += Number(row.monto_asignado)

    const det = facturaMap.get(row.factura_id)
    const alreadyHas = entry.facturas.some((f) => f.factura_id === row.factura_id)
    if (!alreadyHas) {
      entry.num_facturas += 1
      entry.facturas.push({
        factura_id:       row.factura_id,
        numero_documento: det?.numero_documento ?? '—',
        tipo_documento:   det?.tipo_documento   ?? '—',
        fecha_emision:    det?.fecha_emision     ?? '—',
        razon_social:     det?.razon_social      ?? '—',
        monto_bruto:      det?.monto_bruto       ?? 0,
        monto_asignado:   Number(row.monto_asignado),
      })
    } else {
      // Same invoice split across entities — add portion
      const f = entry.facturas.find((f) => f.factura_id === row.factura_id)
      if (f) f.monto_asignado += Number(row.monto_asignado)
    }

    map.set(key, entry)
  }

  // Group by modulo_label
  const moduloMap = new Map<string, ModuloDinamico>()
  for (const entry of map.values()) {
    const mod = moduloMap.get(entry.modulo_label) ?? {
      label: entry.modulo_label,
      total_gastos: 0,
      entidades: [],
      cols_extra: entry.extra_cols,
    }
    // Keep cols_extra from first entity that has them
    if (mod.cols_extra.length === 0 && entry.extra_cols.length > 0) {
      mod.cols_extra = entry.extra_cols
    }
    mod.total_gastos += entry.total_gastos
    mod.entidades.push(entry)
    moduloMap.set(entry.modulo_label, mod)
  }

  // Enrich entities with FRESH data from DB (correct cols_extra + extra_data)
  const enrichItems = rows.map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>
    return {
      config_id: String(meta.config_id ?? ''),
      row_id:    String(meta.row_id    ?? ''),
    }
  }).filter((i) => i.config_id && i.row_id)

  const enrichMap = await fetchFilasParaAsignaciones(supabase, enrichItems)

  // Apply fresh data to each EntidadDinamica
  for (const entry of map.values()) {
    // Find any row belonging to this entity to get its row_id from metadata
    const matchingRow = rows.find((r) => {
      const meta = (r.metadata ?? {}) as Record<string, unknown>
      const rowId = String(meta.row_id ?? '')
      return enrichMap.has(rowId) && r.entidad_id === entry.entidad_id
    })
    if (matchingRow) {
      const meta = (matchingRow.metadata ?? {}) as Record<string, unknown>
      const rowId = String(meta.row_id ?? '')
      const enriched = enrichMap.get(rowId)
      if (enriched) {
        entry.extra_cols = enriched.cols_extra
        entry.extra_data = enriched.extra_data
        entry.entidad_id     = enriched.codigo || entry.entidad_id
        entry.entidad_nombre = enriched.nombre  || entry.entidad_nombre
      }
    }
  }

  // Update modulos' cols_extra from their (now-enriched) first entity
  for (const mod of moduloMap.values()) {
    const firstWithCols = mod.entidades.find((e) => e.extra_cols.length > 0)
    if (firstWithCols) mod.cols_extra = firstWithCols.extra_cols
  }

  // Sort entidades within each module by total_gastos desc
  const modulos = [...moduloMap.values()].sort((a, b) => b.total_gastos - a.total_gastos)
  for (const m of modulos) {
    m.entidades.sort((a, b) => b.total_gastos - a.total_gastos)
  }

  const total_gastos = modulos.reduce((s, m) => s + m.total_gastos, 0)

  return { ok: true, total_gastos, modulos }
}

// ─────────────────────────────────────────────────────────────────────────────
// Output types
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalisisEntidad {
  entidad_tipo: EntidadTipo
  entidad_id: string        // codigo
  nombre: string
  num_facturas: number
  /** Suma de monto_asignado para esta entidad */
  total_gastos: number
  /** Suma de kilos desde produccion_datos */
  kilos: number | null
  /** total_gastos / kilos */
  costo_por_kilo: number | null
  /** Suma de venta_total desde produccion_datos */
  venta_total: number | null
  /** venta_total - total_gastos */
  margen_real: number | null
  /** (margen_real / venta_total) * 100 */
  margen_pct: number | null
  /** precio_por_kilo promedio ponderado desde produccion_datos */
  precio_venta_por_kilo: number | null
  periodo: string
}

export interface ResumenAnalisis {
  total_gastos_asignados: number
  total_ventas: number
  total_kilos: number
  margen_total: number
  margen_pct_total: number | null
  costo_por_kilo_promedio: number | null
}

export interface AnalisisCostosResult {
  ok: boolean
  entidades: AnalisisEntidad[]
  resumen: ResumenAnalisis
  message?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// obtenerAnalisisCostos
// Cruza:  asignaciones_gastos  (gastos)
//     ×   produccion_datos     (kilos + ventas)
//     ×   entidades_costo      (nombre / metadata)
// ─────────────────────────────────────────────────────────────────────────────

export async function obtenerAnalisisCostos(
  clienteId: string,
): Promise<AnalisisCostosResult> {
  const EMPTY: AnalisisCostosResult = {
    ok: false,
    entidades: [],
    resumen: { total_gastos_asignados: 0, total_ventas: 0, total_kilos: 0, margen_total: 0, margen_pct_total: null, costo_por_kilo_promedio: null },
  }

  if (!clienteId?.trim()) return { ...EMPTY, message: 'cliente_id requerido.' }

  const supabase = await createClient()
  const { effectiveUserId } = await getEffectiveUserId(supabase)
  if (!effectiveUserId) return { ...EMPTY, message: 'Sesión expirada.' }
  if (clienteId !== effectiveUserId) {
    // Allow admins
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', effectiveUserId).single()
    if (profile?.role !== 'admin') return { ...EMPTY, message: 'Sin permisos.' }
  }

  // ── Query 1: gastos agregados por entidad ──────────────────────────────
  const { data: gastosRaw, error: e1 } = await supabase
    .from('asignaciones_gastos')
    .select('entidad_tipo, entidad_id, monto_asignado, factura_id')
    .eq('cliente_id', clienteId)

  if (e1) return { ...EMPTY, message: `Error gastos: ${e1.message}` }

  // ── Query 2: produccion_datos agregada por entidad ─────────────────────
  const { data: prodRaw, error: e2 } = await supabase
    .from('produccion_datos')
    .select('entidad_tipo, entidad_id, kilos, venta_total, precio_por_kilo, periodo')
    .eq('cliente_id', clienteId)

  if (e2) return { ...EMPTY, message: `Error producción: ${e2.message}` }

  // ── Query 3: entidades para nombre / lookup ────────────────────────────
  const { data: entidadesRaw, error: e3 } = await supabase
    .from('entidades_costo')
    .select('tipo, codigo, nombre')
    .eq('cliente_id', clienteId)

  if (e3) return { ...EMPTY, message: `Error entidades: ${e3.message}` }

  // ── Aggregate gastos per (tipo, id) ───────────────────────────────────
  type GastoKey = string  // `${tipo}||${id}`
  const gastosMap = new Map<GastoKey, { total: number; facturas: Set<string> }>()

  for (const g of gastosRaw ?? []) {
    const key: GastoKey = `${g.entidad_tipo}||${g.entidad_id}`
    const cur = gastosMap.get(key) ?? { total: 0, facturas: new Set<string>() }
    cur.total += Number(g.monto_asignado)
    cur.facturas.add(g.factura_id)
    gastosMap.set(key, cur)
  }

  // ── Aggregate produccion per (tipo, id) ───────────────────────────────
  type ProdAgg = { kilos: number; venta: number; periodos: string[] }
  const prodMap = new Map<GastoKey, ProdAgg>()

  for (const p of prodRaw ?? []) {
    const key: GastoKey = `${p.entidad_tipo}||${p.entidad_id}`
    const cur = prodMap.get(key) ?? { kilos: 0, venta: 0, periodos: [] }
    cur.kilos += Number(p.kilos)
    cur.venta += Number(p.venta_total)
    if (p.periodo) cur.periodos.push(p.periodo)
    prodMap.set(key, cur)
  }

  // ── Lookup map for entidades ─────────────────────────────────────────
  const entidadNombre = new Map<GastoKey, string>()
  for (const e of entidadesRaw ?? []) {
    entidadNombre.set(`${e.tipo}||${e.codigo}`, e.nombre ?? '')
  }

  // ── Build result array ────────────────────────────────────────────────
  const entidades: AnalisisEntidad[] = []

  // Include all entities that have either gastos OR produccion data
  const allKeys = new Set([...gastosMap.keys(), ...prodMap.keys()])

  for (const key of allKeys) {
    const [tipo, id] = key.split('||') as [EntidadTipo, string]
    const gastos = gastosMap.get(key)
    const prod   = prodMap.get(key)

    const total_gastos = gastos?.total ?? 0
    const num_facturas = gastos?.facturas.size ?? 0
    const kilos        = prod?.kilos && prod.kilos > 0 ? prod.kilos : null
    const venta_total  = prod?.venta && prod.venta > 0 ? prod.venta : null

    const costo_por_kilo  = kilos ? Math.round(total_gastos / kilos) : null
    const margen_real     = venta_total != null ? venta_total - total_gastos : null
    const margen_pct      = margen_real != null && venta_total ? Math.round((margen_real / venta_total) * 10000) / 100 : null
    const precio_venta_por_kilo = (venta_total != null && kilos) ? Math.round(venta_total / kilos) : null

    entidades.push({
      entidad_tipo: tipo,
      entidad_id: id,
      nombre: entidadNombre.get(key) ?? '',
      num_facturas,
      total_gastos,
      kilos,
      costo_por_kilo,
      venta_total,
      margen_real,
      margen_pct,
      precio_venta_por_kilo,
      periodo: prod?.periodos.join(', ') ?? '',
    })
  }

  // Sort: by tipo then by total_gastos desc
  entidades.sort((a, b) =>
    a.entidad_tipo.localeCompare(b.entidad_tipo) ||
    (b.total_gastos - a.total_gastos),
  )

  // ── Global summary ────────────────────────────────────────────────────
  const total_gastos_asignados = entidades.reduce((s, e) => s + e.total_gastos, 0)
  const total_ventas           = entidades.reduce((s, e) => s + (e.venta_total ?? 0), 0)
  const total_kilos            = entidades.reduce((s, e) => s + (e.kilos ?? 0), 0)
  const margen_total           = total_ventas - total_gastos_asignados
  const margen_pct_total       = total_ventas > 0 ? Math.round((margen_total / total_ventas) * 10000) / 100 : null
  const costo_por_kilo_promedio = total_kilos > 0 ? Math.round(total_gastos_asignados / total_kilos) : null

  return {
    ok: true,
    entidades,
    resumen: {
      total_gastos_asignados,
      total_ventas,
      total_kilos,
      margen_total,
      margen_pct_total,
      costo_por_kilo_promedio,
    },
  }
}

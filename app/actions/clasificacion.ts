'use server'

import { createClient } from '@/lib/supabase/server'
import { getEffectiveUserId } from '@/lib/supabase/effective-user-server'
import { fetchFilasParaAsignaciones } from './centros-costo'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentoPendiente {
  id: string
  numero_documento: string
  tipo_documento: string
  fecha_emision: string | null
  monto_neto: number
  monto_iva: number
  monto_bruto: number
  categoria_madre: string
  sub_cuenta: string
  detalle_gasto: string
  estado_clasificacion: string
  // Optional SII columns (from migration 014)
  fecha_devengo: string | null
  fecha_vencimiento: string | null
  tipo_obligacion: string | null
  monto_exento: number
  iva_no_recuperable: number
  otros_impuestos: number
  retencion_honorarios: number
  monto_base: number
  monto_calculado: number
  porcentaje: number | null
  anula_o_modifica: string | null
}

export interface ClasificacionUpdate {
  id: string
  categoria_madre: string
  sub_cuenta: string
  detalle_gasto: string
  estado_clasificacion: 'pendiente' | 'completado'
}

export interface DocumentosPendientesResult {
  ok: boolean
  data: DocumentoPendiente[]
  message?: string
}

export interface ClasificarResult {
  ok: boolean
  actualizados: number
  message: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Action: obtenerDocumentosPorContraparte
// Returns all PENDING documents for a given supplier RUT under a client.
// ─────────────────────────────────────────────────────────────────────────────

export async function obtenerDocumentosPorContraparte(
  clienteId: string,
  rutContraparte: string,
): Promise<DocumentosPendientesResult> {
  if (!clienteId?.trim() || !rutContraparte?.trim()) {
    return { ok: false, data: [], message: 'Parámetros requeridos.' }
  }

  const supabase = await createClient()
  const { userId, effectiveUserId } = await getEffectiveUserId(supabase)

  if (!userId || !effectiveUserId) {
    return { ok: false, data: [], message: 'Sesión expirada.' }
  }

  if (clienteId !== effectiveUserId) {
    return { ok: false, data: [], message: 'Sin permisos.' }
  }

  const { data, error } = await supabase
    .from('registro_compras_sii')
    .select(
      'id, numero_documento, tipo_documento, fecha_emision, monto_neto, monto_iva, monto_bruto, ' +
      'categoria_madre, sub_cuenta, detalle_gasto, estado_clasificacion, ' +
      'fecha_devengo, fecha_vencimiento, tipo_obligacion, monto_exento, ' +
      'iva_no_recuperable, otros_impuestos, retencion_honorarios, ' +
      'monto_base, monto_calculado, porcentaje, anula_o_modifica',
    )
    .eq('cliente_id', clienteId)
    .eq('rut_contraparte', rutContraparte)
    .eq('estado_clasificacion', 'pendiente')
    .order('fecha_emision', { ascending: false })

  if (error) {
    return { ok: false, data: [], message: error.message }
  }

  return { ok: true, data: (data ?? []) as DocumentoPendiente[] }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Action: clasificarDocumentos
// Bulk-updates classification fields + estado_clasificacion for a set of rows.
// Each row may have a different classification.
// ─────────────────────────────────────────────────────────────────────────────

export async function clasificarDocumentos(
  clienteId: string,
  updates: ClasificacionUpdate[],
): Promise<ClasificarResult> {
  if (!clienteId?.trim() || updates.length === 0) {
    return { ok: false, actualizados: 0, message: 'Sin datos para actualizar.' }
  }

  const supabase = await createClient()
  const { userId, effectiveUserId } = await getEffectiveUserId(supabase)

  if (!userId || !effectiveUserId) {
    return { ok: false, actualizados: 0, message: 'Sesión expirada.' }
  }

  if (clienteId !== effectiveUserId) {
    return { ok: false, actualizados: 0, message: 'Sin permisos.' }
  }

  let actualizados = 0
  const BATCH = 10

  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async (u) => {
        const { error } = await supabase
          .from('registro_compras_sii')
          .update({
            categoria_madre: u.categoria_madre,
            sub_cuenta: u.sub_cuenta,
            detalle_gasto: u.detalle_gasto,
            estado_clasificacion: u.estado_clasificacion,
          })
          .eq('id', u.id)
          .eq('cliente_id', clienteId)

        if (!error) actualizados++
      }),
    )
  }

  if (actualizados === 0) {
    return { ok: false, actualizados: 0, message: 'No se pudo actualizar ningún registro.' }
  }

  return {
    ok: true,
    actualizados,
    message: `${actualizados} documento${actualizados !== 1 ? 's' : ''} clasificado${actualizados !== 1 ? 's' : ''} correctamente.`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Action: obtenerDocumentosClasificados
// Returns all COMPLETED documents for a given supplier, with their categories.
// ─────────────────────────────────────────────────────────────────────────────

export interface CentroAsignado {
  label: string
  nombre: string
  entidad_id: string
  monto_asignado: number
  /** Admin-configured extra column names */
  extra_cols: string[]
  /** Full row data keyed by column name */
  extra_data: Record<string, unknown>
}

export interface DocumentoClasificado {
  id: string
  numero_documento: string
  tipo_documento: string
  tipo_obligacion: string | null
  fecha_emision: string | null
  fecha_devengo: string | null
  fecha_vencimiento: string | null
  mes_devengo: string
  monto_neto: number
  monto_exento: number
  monto_iva: number
  iva_no_recuperable: number
  otros_impuestos: number
  retencion_honorarios: number
  monto_bruto: number
  monto_base: number
  monto_calculado: number
  porcentaje: number | null
  anula_o_modifica: string | null
  categoria_madre: string
  sub_cuenta: string
  detalle_gasto: string
  centros_asignados: CentroAsignado[]
}

export interface DocumentosClasificadosResult {
  ok: boolean
  data: DocumentoClasificado[]
  message?: string
}

export async function obtenerDocumentosClasificados(
  clienteId: string,
  rutContraparte: string,
): Promise<DocumentosClasificadosResult> {
  if (!clienteId?.trim() || !rutContraparte?.trim()) {
    return { ok: false, data: [], message: 'Parámetros requeridos.' }
  }

  const supabase = await createClient()
  const { userId, effectiveUserId } = await getEffectiveUserId(supabase)

  if (!userId || !effectiveUserId) {
    return { ok: false, data: [], message: 'Sesión expirada.' }
  }

  if (clienteId !== effectiveUserId) {
    return { ok: false, data: [], message: 'Sin permisos.' }
  }

  const { data, error } = await supabase
    .from('registro_compras_sii')
    .select(
      'id, numero_documento, tipo_documento, tipo_obligacion, fecha_emision, fecha_devengo, fecha_vencimiento, mes_devengo, monto_neto, monto_exento, monto_iva, iva_no_recuperable, otros_impuestos, retencion_honorarios, monto_bruto, monto_base, monto_calculado, porcentaje, anula_o_modifica, categoria_madre, sub_cuenta, detalle_gasto',
    )
    .eq('cliente_id', clienteId)
    .eq('rut_contraparte', rutContraparte)
    .eq('estado_clasificacion', 'completado')
    .order('categoria_madre', { ascending: true })
    .order('sub_cuenta', { ascending: true })
    .order('fecha_emision', { ascending: false })

  if (error) {
    return { ok: false, data: [], message: error.message }
  }

  // Fetch cost center assignments for all these docs in one query
  const docIds = (data ?? []).map((d) => d.id)
  const asigsByDoc = new Map<string, CentroAsignado[]>()

  if (docIds.length > 0) {
    const { data: asigs } = await supabase
      .from('asignaciones_gastos')
      .select('factura_id, entidad_id, monto_asignado, metadata')
      .eq('cliente_id', clienteId)
      .eq('entidad_tipo', 'dinamico')
      .in('factura_id', docIds)

    // Enrich with FRESH data from DB (correct col names + cols_extra)
    const enrichItems = (asigs ?? []).map((a) => {
      const meta = (a.metadata ?? {}) as Record<string, unknown>
      return { config_id: String(meta.config_id ?? ''), row_id: String(meta.row_id ?? '') }
    }).filter((i) => i.config_id && i.row_id)

    const enrichMap = await fetchFilasParaAsignaciones(supabase, enrichItems)

    for (const a of asigs ?? []) {
      const meta = (a.metadata ?? {}) as Record<string, unknown>
      const rowId = String(meta.row_id ?? '')
      const enriched = enrichMap.get(rowId)

      const entry: CentroAsignado = {
        label:          String(meta.label ?? ''),
        nombre:         enriched?.nombre  ?? String(meta.nombre ?? ''),
        entidad_id:     enriched?.codigo  ?? a.entidad_id,
        monto_asignado: Number(a.monto_asignado),
        extra_cols:     enriched?.cols_extra ?? [],
        extra_data:     enriched?.extra_data ?? {},
      }
      const list = asigsByDoc.get(a.factura_id) ?? []
      list.push(entry)
      asigsByDoc.set(a.factura_id, list)
    }
  }

  const mapped = (data ?? []).map((d) => ({
    ...d,
    centros_asignados: asigsByDoc.get(d.id) ?? [],
  })) as DocumentoClasificado[]

  return { ok: true, data: mapped }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Action: reabrirDocumentosParaEditar
// Resets selected docs back to 'pendiente' and deletes their cost assignments,
// so the user can re-classify and re-assign them.
// ─────────────────────────────────────────────────────────────────────────────

export async function reabrirDocumentosParaEditar(
  clienteId: string,
  facturaIds: string[],
): Promise<{ ok: boolean; message: string }> {
  if (!clienteId?.trim() || facturaIds.length === 0) {
    return { ok: false, message: 'Parámetros requeridos.' }
  }

  const supabase = await createClient()
  const { effectiveUserId } = await getEffectiveUserId(supabase)
  if (!effectiveUserId) return { ok: false, message: 'Sesión expirada.' }
  if (clienteId !== effectiveUserId) return { ok: false, message: 'Sin permisos.' }

  // NOTE: We intentionally keep asignaciones_gastos intact so the cost center
  // assignment is preserved during re-classification. The user can update or
  // replace the cost center from the AsignacionPanel if needed.

  // Reset only the classification categories back to pending
  const { error } = await supabase
    .from('registro_compras_sii')
    .update({
      estado_clasificacion: 'pendiente',
      categoria_madre: '',
      sub_cuenta: '',
      detalle_gasto: '',
    })
    .eq('cliente_id', clienteId)
    .in('id', facturaIds)

  if (error) return { ok: false, message: error.message }

  return {
    ok: true,
    message: `${facturaIds.length} documento${facturaIds.length !== 1 ? 's' : ''} reabierto${facturaIds.length !== 1 ? 's' : ''} para editar.`,
  }
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { getEffectiveUserId } from '@/lib/supabase/effective-user-server'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type EntidadTipo = 'contenedor' | 'producto_terminado' | 'pallet'

export interface EntidadCosto {
  id: string
  tipo: EntidadTipo
  codigo: string
  nombre: string
  metadata: Record<string, unknown>
}

export interface AsignacionInput {
  entidad_id: string    // codigo de la entidad
  entidad_tipo: EntidadTipo
  monto_asignado: number
  porcentaje: number
  metadata?: Record<string, unknown>
}

export interface AsignacionGuardada {
  id: string
  factura_id: string
  entidad_tipo: EntidadTipo
  entidad_id: string
  monto_asignado: number
  porcentaje: number
  metadata: Record<string, unknown>
}

export interface BuscarResult {
  ok: boolean
  data: EntidadCosto[]
  message?: string
}

export interface AsignacionesResult {
  ok: boolean
  data: AsignacionGuardada[]
  message?: string
}

export interface GuardarResult {
  ok: boolean
  creados: number
  message: string
}

// ─────────────────────────────────────────────────────────────────────────────
// obtenerTiposDisponibles — returns which entity types the client actually has
// ─────────────────────────────────────────────────────────────────────────────

export async function obtenerTiposDisponibles(
  clienteId: string,
): Promise<{ ok: boolean; tipos: EntidadTipo[]; message?: string }> {
  const supabase = await createClient()
  const { effectiveUserId } = await getEffectiveUserId(supabase)
  if (!effectiveUserId) return { ok: false, tipos: [], message: 'Sesión expirada.' }

  const { data, error } = await supabase
    .from('entidades_costo')
    .select('tipo')
    .eq('cliente_id', clienteId)
    .eq('activo', true)

  if (error) return { ok: false, tipos: [], message: error.message }

  const tipos = [...new Set((data ?? []).map((r) => r.tipo as EntidadTipo))]
  return { ok: true, tipos }
}

// ─────────────────────────────────────────────────────────────────────────────
// listarEntidades — paginated list for the table picker (with optional filter)
// ─────────────────────────────────────────────────────────────────────────────

export interface ListarResult {
  ok: boolean
  data: EntidadCosto[]
  total: number
  message?: string
}

export async function listarEntidades(
  clienteId: string,
  tipo: EntidadTipo,
  query = '',
  page = 0,
  pageSize = 30,
): Promise<ListarResult> {
  const supabase = await createClient()
  const { effectiveUserId } = await getEffectiveUserId(supabase)
  if (!effectiveUserId) return { ok: false, data: [], total: 0, message: 'Sesión expirada.' }

  let req = supabase
    .from('entidades_costo')
    .select('id, tipo, codigo, nombre, metadata', { count: 'exact' })
    .eq('cliente_id', clienteId)
    .eq('tipo', tipo)
    .eq('activo', true)
    .order('codigo', { ascending: true })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (query.trim()) {
    req = req.or(`codigo.ilike.%${query.trim()}%,nombre.ilike.%${query.trim()}%`)
  }

  const { data, error, count } = await req
  if (error) return { ok: false, data: [], total: 0, message: error.message }
  return { ok: true, data: (data ?? []) as EntidadCosto[], total: count ?? 0 }
}

// ─────────────────────────────────────────────────────────────────────────────
// buscarEntidades — full-text + prefix search for the multi-select
// ─────────────────────────────────────────────────────────────────────────────

export async function buscarEntidades(
  clienteId: string,
  tipo: EntidadTipo,
  query: string,
): Promise<BuscarResult> {
  const supabase = await createClient()
  const { effectiveUserId } = await getEffectiveUserId(supabase)
  if (!effectiveUserId) return { ok: false, data: [], message: 'Sesión expirada.' }

  let req = supabase
    .from('entidades_costo')
    .select('id, tipo, codigo, nombre, metadata')
    .eq('cliente_id', clienteId)
    .eq('tipo', tipo)
    .eq('activo', true)
    .order('codigo', { ascending: true })
    .limit(30)

  if (query.trim()) {
    // ilike search across codigo and nombre
    req = req.or(`codigo.ilike.%${query.trim()}%,nombre.ilike.%${query.trim()}%`)
  }

  const { data, error } = await req
  if (error) return { ok: false, data: [], message: error.message }
  return { ok: true, data: (data ?? []) as EntidadCosto[] }
}

// ─────────────────────────────────────────────────────────────────────────────
// obtenerAsignacionesPorFactura — load existing assignments for a document
// ─────────────────────────────────────────────────────────────────────────────

export async function obtenerAsignacionesPorFactura(
  facturaId: string,
  clienteId: string,
): Promise<AsignacionesResult> {
  const supabase = await createClient()
  const { effectiveUserId } = await getEffectiveUserId(supabase)
  if (!effectiveUserId) return { ok: false, data: [], message: 'Sesión expirada.' }

  const { data, error } = await supabase
    .from('asignaciones_gastos')
    .select('id, factura_id, entidad_tipo, entidad_id, monto_asignado, porcentaje, metadata')
    .eq('factura_id', facturaId)
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: true })

  if (error) return { ok: false, data: [], message: error.message }
  return { ok: true, data: (data ?? []) as AsignacionGuardada[] }
}

// ─────────────────────────────────────────────────────────────────────────────
// guardarAsignaciones — upsert: delete old + insert new assignments
// Also updates estado_clasificacion on the factura when requested.
// ─────────────────────────────────────────────────────────────────────────────

export async function guardarAsignaciones(
  clienteId: string,
  facturaId: string,
  montoTotal: number,
  asignaciones: AsignacionInput[],
  marcarClasificada = false,
): Promise<GuardarResult> {
  if (!asignaciones.length) {
    return { ok: false, creados: 0, message: 'Debes seleccionar al menos una entidad.' }
  }

  const supabase = await createClient()
  const { userId, effectiveUserId } = await getEffectiveUserId(supabase)
  if (!userId || !effectiveUserId) {
    return { ok: false, creados: 0, message: 'Sesión expirada.' }
  }

  // Allow admin OR the client themselves
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  const isAdmin = profile?.role === 'admin'

  if (!isAdmin && clienteId !== effectiveUserId) {
    return { ok: false, creados: 0, message: `Sin permisos. (clienteId=${clienteId.slice(0,8)} effectiveUserId=${effectiveUserId.slice(0,8)})` }
  }

  // Use a service-role-style insert when admin is acting on behalf of client
  // by passing clienteId directly (RLS uses effective_user_id which would be admin's ID)
  // We use the admin's session which has RLS policies with admin bypass.

  // Delete previous assignments for this factura
  const { error: delError } = await supabase
    .from('asignaciones_gastos')
    .delete()
    .eq('factura_id', facturaId)
    .eq('cliente_id', clienteId)

  if (delError) return { ok: false, creados: 0, message: `Error al limpiar asignaciones: ${delError.message}` }

  // Insert new assignments
  const rows = asignaciones.map((a) => ({
    cliente_id: clienteId,
    factura_id: facturaId,
    entidad_tipo: a.entidad_tipo,
    entidad_id: a.entidad_id,
    monto_asignado: a.monto_asignado,
    porcentaje: a.porcentaje,
    metadata: a.metadata ?? {},
  }))

  const { error: insError } = await supabase.from('asignaciones_gastos').insert(rows)
  if (insError) return { ok: false, creados: 0, message: `Error al guardar: ${insError.message}` }

  // Optionally mark the factura as classified
  if (marcarClasificada) {
    await supabase
      .from('registro_compras_sii')
      .update({ estado_clasificacion: 'completado' })
      .eq('id', facturaId)
      .eq('cliente_id', clienteId)
  }

  const n = asignaciones.length
  return {
    ok: true,
    creados: n,
    message: `${n} asignación${n !== 1 ? 'es' : ''} guardada${n !== 1 ? 's' : ''}. Monto de ${
      new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(montoTotal)
    } dividido en ${n} parte${n !== 1 ? 's' : ''} iguales.`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// eliminarAsignaciones — remove all assignments for a factura
// ─────────────────────────────────────────────────────────────────────────────

export async function eliminarAsignaciones(
  facturaId: string,
  clienteId: string,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient()
  const { userId, effectiveUserId } = await getEffectiveUserId(supabase)
  if (!userId || !effectiveUserId || clienteId !== effectiveUserId) {
    return { ok: false, message: 'Sin permisos.' }
  }

  const { error } = await supabase
    .from('asignaciones_gastos')
    .delete()
    .eq('factura_id', facturaId)
    .eq('cliente_id', clienteId)

  if (error) return { ok: false, message: error.message }
  return { ok: true, message: 'Asignaciones eliminadas.' }
}

'use server'

import { createClient } from '@/lib/supabase/server'
import type { EntidadTipo } from './asignaciones'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EntidadRow {
  id: string
  tipo: EntidadTipo
  codigo: string
  nombre: string
  activo: boolean
  created_at: string
}

export interface EntidadResult {
  ok: boolean
  data: EntidadRow[]
  message?: string
}

export interface MutateResult {
  ok: boolean
  message: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, ok: false }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return { supabase, user, ok: profile?.role === 'admin' }
}

// ─────────────────────────────────────────────────────────────────────────────
// listarEntidadesAdmin — get all entities for a client (by type)
// ─────────────────────────────────────────────────────────────────────────────

export async function listarEntidadesAdmin(
  clienteId: string,
  tipo?: EntidadTipo,
): Promise<EntidadResult> {
  const { supabase, ok } = await requireAdmin()
  if (!ok) return { ok: false, data: [], message: 'Sin permisos de administrador.' }

  let query = supabase
    .from('entidades_costo')
    .select('id, tipo, codigo, nombre, activo, created_at')
    .eq('cliente_id', clienteId)
    .order('tipo', { ascending: true })
    .order('codigo', { ascending: true })

  if (tipo) query = query.eq('tipo', tipo)

  const { data, error } = await query
  if (error) return { ok: false, data: [], message: error.message }
  return { ok: true, data: (data ?? []) as EntidadRow[] }
}

// ─────────────────────────────────────────────────────────────────────────────
// crearEntidad — add one entity
// ─────────────────────────────────────────────────────────────────────────────

export async function crearEntidad(
  clienteId: string,
  tipo: EntidadTipo,
  codigo: string,
  nombre: string,
): Promise<MutateResult> {
  const { supabase, ok } = await requireAdmin()
  if (!ok) return { ok: false, message: 'Sin permisos de administrador.' }

  const c = codigo.trim().toUpperCase()
  const n = nombre.trim()
  if (!c) return { ok: false, message: 'El código es obligatorio.' }

  const { error } = await supabase
    .from('entidades_costo')
    .insert({ cliente_id: clienteId, tipo, codigo: c, nombre: n })

  if (error) {
    if (error.code === '23505') return { ok: false, message: `Ya existe un ${tipo} con el código "${c}".` }
    return { ok: false, message: error.message }
  }
  return { ok: true, message: `${tipo} "${c}" creado.` }
}

// ─────────────────────────────────────────────────────────────────────────────
// importarEntidadesBulk — create multiple entities from a text block
// Each line: CODIGO  (tab or spaces or semicolon)  NOMBRE
// ─────────────────────────────────────────────────────────────────────────────

export async function importarEntidadesBulk(
  clienteId: string,
  tipo: EntidadTipo,
  texto: string,
): Promise<{ ok: boolean; creados: number; errores: string[]; message: string }> {
  const { supabase, ok } = await requireAdmin()
  if (!ok) return { ok: false, creados: 0, errores: [], message: 'Sin permisos.' }

  const lines = texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length === 0) return { ok: false, creados: 0, errores: [], message: 'No hay líneas para importar.' }

  const rows = lines.map((line) => {
    // Split on tab, semicolon, or 2+ spaces
    const parts = line.split(/\t|;|  +/)
    const codigo = (parts[0] ?? '').trim().toUpperCase()
    const nombre = (parts.slice(1).join(' ')).trim()
    return { cliente_id: clienteId, tipo, codigo, nombre }
  }).filter((r) => r.codigo)

  const errores: string[] = []
  let creados = 0

  // Insert in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const { error, data } = await supabase
      .from('entidades_costo')
      .upsert(batch, { onConflict: 'cliente_id,tipo,codigo', ignoreDuplicates: false })
      .select('id')
    if (error) {
      errores.push(`Lote ${i / 50 + 1}: ${error.message}`)
    } else {
      creados += data?.length ?? batch.length
    }
  }

  return {
    ok: creados > 0,
    creados,
    errores,
    message: errores.length
      ? `${creados} creados con ${errores.length} errores.`
      : `${creados} entidades importadas correctamente.`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// actualizarEntidad — edit codigo / nombre / activo
// ─────────────────────────────────────────────────────────────────────────────

export async function actualizarEntidad(
  id: string,
  campos: Partial<{ codigo: string; nombre: string; activo: boolean }>,
): Promise<MutateResult> {
  const { supabase, ok } = await requireAdmin()
  if (!ok) return { ok: false, message: 'Sin permisos de administrador.' }

  const update: Record<string, unknown> = {}
  if (campos.codigo !== undefined) update.codigo = campos.codigo.trim().toUpperCase()
  if (campos.nombre !== undefined) update.nombre = campos.nombre.trim()
  if (campos.activo !== undefined) update.activo = campos.activo

  if (!Object.keys(update).length) return { ok: false, message: 'Nada que actualizar.' }

  const { error } = await supabase.from('entidades_costo').update(update).eq('id', id)
  if (error) return { ok: false, message: error.message }
  return { ok: true, message: 'Entidad actualizada.' }
}

// ─────────────────────────────────────────────────────────────────────────────
// eliminarEntidad — hard delete
// ─────────────────────────────────────────────────────────────────────────────

export async function eliminarEntidad(id: string): Promise<MutateResult> {
  const { supabase, ok } = await requireAdmin()
  if (!ok) return { ok: false, message: 'Sin permisos de administrador.' }

  const { error } = await supabase.from('entidades_costo').delete().eq('id', id)
  if (error) return { ok: false, message: error.message }
  return { ok: true, message: 'Entidad eliminada.' }
}

// ─────────────────────────────────────────────────────────────────────────────
// eliminarTipoCompleto — delete all entities of a type for a client
// ─────────────────────────────────────────────────────────────────────────────

export async function eliminarTipoCompleto(
  clienteId: string,
  tipo: EntidadTipo,
): Promise<MutateResult> {
  const { supabase, ok } = await requireAdmin()
  if (!ok) return { ok: false, message: 'Sin permisos de administrador.' }

  const { error, count } = await supabase
    .from('entidades_costo')
    .delete({ count: 'exact' })
    .eq('cliente_id', clienteId)
    .eq('tipo', tipo)

  if (error) return { ok: false, message: error.message }
  return { ok: true, message: `${count ?? 0} entidades eliminadas.` }
}

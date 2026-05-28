'use server'

import { createClient } from '@/lib/supabase/server'
import { TAXONOMY as DEFAULT_TAXONOMY } from '@/lib/clasificacion-taxonomy'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Nivel {
  numero: number
  label: string
}

export interface OpcionNivel {
  id: string
  nivel_numero: number
  opcion_texto: string
  activo: boolean
  orden: number
}

export interface TaxonomiaConfig {
  niveles: Nivel[]
}

/** Full taxonomy for admin management */
export interface TaxonomiaCompleta {
  ok: boolean
  config: TaxonomiaConfig
  /** nivel_numero → sorted options */
  opciones: Record<number, OpcionNivel[]>
  message?: string
}

/** Simplified structure for the classification sheet */
export interface TaxonomiaParaSheet {
  niveles: Nivel[]
  /** nivel_numero → sorted option texts */
  opciones: Record<number, string[]>
}

export interface ActionResult {
  ok: boolean
  message: string
  id?: string
}

const DEFAULT_NIVELES: Nivel[] = [
  { numero: 1, label: 'Cuenta Madre' },
  { numero: 2, label: 'Sub-Cuenta' },
  { numero: 3, label: 'Detalle' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

async function assertAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return data?.role === 'admin'
}

function parseNiveles(raw: unknown): Nivel[] {
  if (!Array.isArray(raw)) return DEFAULT_NIVELES
  return (raw as Nivel[]).filter((n) => n && typeof n.numero === 'number' && typeof n.label === 'string')
}

// ─────────────────────────────────────────────────────────────────────────────
// obtenerTaxonomiaCompleta — admin
// ─────────────────────────────────────────────────────────────────────────────

export async function obtenerTaxonomiaCompleta(clienteId: string): Promise<TaxonomiaCompleta> {
  const supabase = await createClient()
  if (!(await assertAdmin(supabase))) {
    return { ok: false, config: { niveles: DEFAULT_NIVELES }, opciones: {}, message: 'Sin permisos.' }
  }

  const [configRes, opcionesRes] = await Promise.all([
    supabase
      .from('clasificacion_config')
      .select('niveles')
      .eq('cliente_id', clienteId)
      .single(),
    supabase
      .from('clasificacion_opciones')
      .select('id,nivel_numero,opcion_texto,activo,orden')
      .eq('cliente_id', clienteId)
      .order('nivel_numero', { ascending: true })
      .order('orden', { ascending: true })
      .order('opcion_texto', { ascending: true }),
  ])

  const niveles = configRes.data ? parseNiveles(configRes.data.niveles) : DEFAULT_NIVELES
  const raw = (opcionesRes.data ?? []) as OpcionNivel[]

  const opciones: Record<number, OpcionNivel[]> = {}
  for (const op of raw) {
    if (!opciones[op.nivel_numero]) opciones[op.nivel_numero] = []
    opciones[op.nivel_numero].push(op)
  }

  return { ok: true, config: { niveles }, opciones }
}

// ─────────────────────────────────────────────────────────────────────────────
// obtenerTaxonomiaParaSheet — client-facing (no admin check)
// Falls back to hardcoded default when no custom config exists.
// ─────────────────────────────────────────────────────────────────────────────

export async function obtenerTaxonomiaParaSheet(clienteId: string): Promise<TaxonomiaParaSheet> {
  const supabase = await createClient()

  const [configRes, opcionesRes] = await Promise.all([
    supabase
      .from('clasificacion_config')
      .select('niveles')
      .eq('cliente_id', clienteId)
      .single(),
    supabase
      .from('clasificacion_opciones')
      .select('nivel_numero,opcion_texto,orden')
      .eq('cliente_id', clienteId)
      .eq('activo', true)
      .order('nivel_numero', { ascending: true })
      .order('orden', { ascending: true })
      .order('opcion_texto', { ascending: true }),
  ])

  const niveles = configRes.data ? parseNiveles(configRes.data.niveles) : DEFAULT_NIVELES

  // If no custom options, fall back to hardcoded taxonomy (flattened per level)
  const hasCustomOptions = (opcionesRes.data ?? []).length > 0
  let opciones: Record<number, string[]>

  if (hasCustomOptions) {
    opciones = {}
    for (const row of opcionesRes.data ?? []) {
      const n = (row as { nivel_numero: number; opcion_texto: string }).nivel_numero
      const t = (row as { nivel_numero: number; opcion_texto: string }).opcion_texto
      if (!opciones[n]) opciones[n] = []
      opciones[n].push(t)
    }
  } else {
    // Flatten hardcoded taxonomy into per-level lists
    const l1 = new Set<string>()
    const l2 = new Set<string>()
    const l3 = new Set<string>()
    for (const [n1, subs] of Object.entries(DEFAULT_TAXONOMY)) {
      l1.add(n1)
      for (const [n2, details] of Object.entries(subs)) {
        l2.add(n2)
        for (const n3 of details) l3.add(n3)
      }
    }
    opciones = { 1: [...l1], 2: [...l2], 3: [...l3] }
  }

  return { niveles, opciones }
}

// ─────────────────────────────────────────────────────────────────────────────
// guardarNiveles — update/add/remove levels for a client
// ─────────────────────────────────────────────────────────────────────────────

export async function guardarNiveles(clienteId: string, niveles: Nivel[]): Promise<ActionResult> {
  if (!niveles.length) return { ok: false, message: 'Debe haber al menos un nivel.' }
  const supabase = await createClient()
  if (!(await assertAdmin(supabase))) return { ok: false, message: 'Sin permisos.' }

  const { error } = await supabase
    .from('clasificacion_config')
    .upsert(
      { cliente_id: clienteId, niveles: niveles, updated_at: new Date().toISOString() },
      { onConflict: 'cliente_id' },
    )

  if (error) return { ok: false, message: `Error: ${error.message}` }
  return { ok: true, message: 'Niveles guardados.' }
}

// ─────────────────────────────────────────────────────────────────────────────
// crearOpcion — add a new selectable option to a level
// ─────────────────────────────────────────────────────────────────────────────

export async function crearOpcion(
  clienteId: string,
  nivelNumero: number,
  opcionTexto: string,
  orden = 0,
): Promise<ActionResult> {
  const texto = opcionTexto.trim()
  if (!texto) return { ok: false, message: 'El texto de la opción no puede estar vacío.' }

  const supabase = await createClient()
  if (!(await assertAdmin(supabase))) return { ok: false, message: 'Sin permisos.' }

  const { data, error } = await supabase
    .from('clasificacion_opciones')
    .insert({ cliente_id: clienteId, nivel_numero: nivelNumero, opcion_texto: texto, orden, activo: true })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, message: 'Esa opción ya existe en este nivel.' }
    return { ok: false, message: `Error: ${error.message}` }
  }
  return { ok: true, message: 'Opción creada.', id: data?.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// actualizarOpcion — rename / toggle active
// ─────────────────────────────────────────────────────────────────────────────

export async function actualizarOpcion(
  id: string,
  clienteId: string,
  opcionTexto: string,
  activo: boolean,
  orden: number,
): Promise<ActionResult> {
  const texto = opcionTexto.trim()
  if (!texto) return { ok: false, message: 'El texto no puede estar vacío.' }

  const supabase = await createClient()
  if (!(await assertAdmin(supabase))) return { ok: false, message: 'Sin permisos.' }

  const { error } = await supabase
    .from('clasificacion_opciones')
    .update({ opcion_texto: texto, activo, orden })
    .eq('id', id)
    .eq('cliente_id', clienteId)

  if (error) return { ok: false, message: `Error: ${error.message}` }
  return { ok: true, message: 'Opción actualizada.' }
}

// ─────────────────────────────────────────────────────────────────────────────
// eliminarOpcion — hard delete
// ─────────────────────────────────────────────────────────────────────────────

export async function eliminarOpcion(id: string, clienteId: string): Promise<ActionResult> {
  const supabase = await createClient()
  if (!(await assertAdmin(supabase))) return { ok: false, message: 'Sin permisos.' }

  const { error } = await supabase
    .from('clasificacion_opciones')
    .delete()
    .eq('id', id)
    .eq('cliente_id', clienteId)

  if (error) return { ok: false, message: `Error: ${error.message}` }
  return { ok: true, message: 'Opción eliminada.' }
}

// ─────────────────────────────────────────────────────────────────────────────
// importarOpcionesDefault — seed from hardcoded taxonomy, per level
// ─────────────────────────────────────────────────────────────────────────────

export async function importarOpcionesDefault(
  clienteId: string,
  soloNivel?: number,
): Promise<ActionResult> {
  const supabase = await createClient()
  if (!(await assertAdmin(supabase))) return { ok: false, message: 'Sin permisos.' }

  const l1 = new Set<string>()
  const l2 = new Set<string>()
  const l3 = new Set<string>()

  for (const [n1, subs] of Object.entries(DEFAULT_TAXONOMY)) {
    l1.add(n1)
    for (const [n2, details] of Object.entries(subs)) {
      l2.add(n2)
      for (const n3 of details) l3.add(n3)
    }
  }

  const sources: [number, Set<string>][] = [
    [1, l1], [2, l2], [3, l3],
  ]

  const rows = sources
    .filter(([n]) => soloNivel == null || n === soloNivel)
    .flatMap(([n, set], _i) =>
      [...set].map((texto, orden) => ({
        cliente_id: clienteId,
        nivel_numero: n,
        opcion_texto: texto,
        orden,
        activo: true,
      })),
    )

  if (rows.length === 0) return { ok: false, message: 'Nada que importar.' }

  const { error } = await supabase
    .from('clasificacion_opciones')
    .upsert(rows, { onConflict: 'cliente_id,nivel_numero,opcion_texto', ignoreDuplicates: true })

  if (error) return { ok: false, message: `Error: ${error.message}` }
  return { ok: true, message: `${rows.length} opciones importadas.` }
}

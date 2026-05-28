'use server'

import { createClient } from '@/lib/supabase/server'
import { getEffectiveUserId } from '@/lib/supabase/effective-user-server'
import { NATIVE_MODULES, ALLOWED_NATIVE_TABLES, getNativeDefsForSlug } from '@/lib/native-modules'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CentroCostoConfig {
  id: string
  cliente_id: string
  tipo_tabla: 'dynamic' | 'native'
  tabla_id: string | null
  tabla_nombre_real: string | null
  label: string
  col_codigo: string
  col_nombre: string
  cols_extra: string
  activo: boolean
  orden: number
  tabla_nombre?: string
  modulo_nombre?: string
}

export interface TablaOption {
  id: string
  nombre: string
  columnas: string[]
  habilitado: boolean
  config_id?: string
  col_codigo?: string
  col_nombre?: string
  cols_extra?: string
  label?: string
  /** 'dynamic' | 'native' */
  tipo: 'dynamic' | 'native'
  /** only for native */
  tabla_nombre_real?: string
}

export interface ModuleConTablas {
  modulo_id: string
  modulo_nombre: string
  modulo_slug: string
  tablas: TablaOption[]
}

export interface FilaTabla {
  row_id: string
  data: Record<string, unknown>
  codigo: string
  nombre: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, ok: false }
  const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return { supabase, ok: p?.role === 'admin' }
}

// ─────────────────────────────────────────────────────────────────────────────
// listarModulosConTablas — admin view
// Returns enabled modules with both dynamic tables AND native tables
// ─────────────────────────────────────────────────────────────────────────────

export async function listarModulosConTablas(
  clienteId: string,
): Promise<{ ok: boolean; data: ModuleConTablas[]; message?: string }> {
  const { supabase, ok } = await requireAdmin()
  if (!ok) return { ok: false, data: [], message: 'Sin permisos.' }

  // Get enabled modules for the client
  const { data: access } = await supabase
    .from('user_module_access')
    .select('module_id, module:modules(id, name, slug)')
    .eq('user_id', clienteId)
    .eq('enabled', true)

  if (!access?.length) return { ok: true, data: [] }

  const moduleIds = access.map((a) => (a.module as { id: string }).id)

  // Dynamic tables for those modules
  const { data: tablas } = await supabase
    .from('dynamic_tables')
    .select('id, name, columns, module_id')
    .eq('user_id', clienteId)
    .in('module_id', moduleIds)
    .order('name', { ascending: true })

  // Existing centros_costo_config for this client
  const { data: configs } = await supabase
    .from('centros_costo_config')
    .select('id, tabla_id, tabla_nombre_real, tipo_tabla, col_codigo, col_nombre, cols_extra, label, activo')
    .eq('cliente_id', clienteId)

  const configByDynamic = new Map((configs ?? []).filter((c) => c.tabla_id).map((c) => [c.tabla_id as string, c]))
  const configByNative  = new Map((configs ?? []).filter((c) => c.tabla_nombre_real).map((c) => [c.tabla_nombre_real as string, c]))

  const result: ModuleConTablas[] = []

  for (const a of access) {
    const mod = a.module as { id: string; name: string; slug: string }
    if (!mod) continue

    const opciones: TablaOption[] = []

    // 1) Dynamic tables for this module
    const modTablas = (tablas ?? []).filter((t) => t.module_id === mod.id)
    for (const t of modTablas) {
      const cfg = configByDynamic.get(t.id)
      const cols: string[] = Array.isArray(t.columns)
        ? (t.columns as { name?: string }[]).map((c) => c.name ?? '').filter(Boolean)
        : []
      opciones.push({
        id: t.id,
        nombre: t.name,
        columnas: cols,
        habilitado: !!cfg,
        config_id: cfg?.id,
        col_codigo: cfg?.col_codigo,
        col_nombre: cfg?.col_nombre,
        cols_extra: cfg?.cols_extra,
        label: cfg?.label,
        tipo: 'dynamic',
      })
    }

    // 2) Native tables for this module slug
    const nativeDefs = getNativeDefsForSlug(mod.slug)
    for (const def of nativeDefs) {
      const cfg = configByNative.get(def.tabla)
      opciones.push({
        id: `native:${def.tabla}`,
        nombre: def.tabla,
        columnas: [def.col_codigo, def.col_nombre, ...def.cols_extra].filter(Boolean),
        habilitado: !!cfg,
        config_id: cfg?.id,
        col_codigo: cfg?.col_codigo ?? def.col_codigo,
        col_nombre: cfg?.col_nombre ?? def.col_nombre,
        cols_extra: cfg?.cols_extra ?? def.cols_extra.join(','),
        label: cfg?.label ?? def.label,
        tipo: 'native',
        tabla_nombre_real: def.tabla,
      })
    }

    if (opciones.length > 0) {
      result.push({
        modulo_id: mod.id,
        modulo_nombre: mod.name,
        modulo_slug: mod.slug,
        tablas: opciones,
      })
    }
  }

  return { ok: true, data: result }
}

// ─────────────────────────────────────────────────────────────────────────────
// habilitarCentro — create or update config (dynamic or native)
// ─────────────────────────────────────────────────────────────────────────────

export async function habilitarCentro(
  clienteId: string,
  opts: {
    tipo: 'dynamic'
    tablaId: string
    label: string
    colCodigo: string
    colNombre: string
    colsExtra?: string
  } | {
    tipo: 'native'
    tablaNombreReal: string
    label: string
    colCodigo: string
    colNombre: string
    colsExtra?: string
  },
): Promise<{ ok: boolean; message: string }> {
  const { supabase, ok } = await requireAdmin()
  if (!ok) return { ok: false, message: 'Sin permisos.' }

  if (!opts.label.trim() || !opts.colCodigo.trim()) {
    return { ok: false, message: 'Etiqueta y columna de código son obligatorias.' }
  }

  const payload = {
    cliente_id: clienteId,
    label: opts.label.trim(),
    col_codigo: opts.colCodigo.trim(),
    col_nombre: opts.colNombre.trim(),
    cols_extra: opts.colsExtra?.trim() ?? '',
    activo: true,
    tipo_tabla: opts.tipo,
  }

  if (opts.tipo === 'dynamic') {
    // Check if a config already exists for this (cliente_id, tabla_id) pair
    const { data: existing } = await supabase
      .from('centros_costo_config')
      .select('id')
      .eq('cliente_id', clienteId)
      .eq('tabla_id', opts.tablaId)
      .maybeSingle()

    const { error } = existing
      ? await supabase
          .from('centros_costo_config')
          .update({ ...payload, tabla_nombre_real: null })
          .eq('id', existing.id)
      : await supabase
          .from('centros_costo_config')
          .insert({ ...payload, tabla_id: opts.tablaId, tabla_nombre_real: null })

    if (error) return { ok: false, message: error.message }
  } else {
    // Check if a config already exists for this (cliente_id, tabla_nombre_real) pair
    const { data: existing } = await supabase
      .from('centros_costo_config')
      .select('id')
      .eq('cliente_id', clienteId)
      .eq('tabla_nombre_real', opts.tablaNombreReal)
      .maybeSingle()

    const { error } = existing
      ? await supabase
          .from('centros_costo_config')
          .update({ ...payload, tabla_id: null })
          .eq('id', existing.id)
      : await supabase
          .from('centros_costo_config')
          .insert({ ...payload, tabla_id: null, tabla_nombre_real: opts.tablaNombreReal })

    if (error) return { ok: false, message: error.message }
  }

  return { ok: true, message: `Centro de costo "${opts.label}" habilitado.` }
}

// ─────────────────────────────────────────────────────────────────────────────
// deshabilitarCentro
// ─────────────────────────────────────────────────────────────────────────────

export async function deshabilitarCentro(
  configId: string,
): Promise<{ ok: boolean; message: string }> {
  const { supabase, ok } = await requireAdmin()
  if (!ok) return { ok: false, message: 'Sin permisos.' }

  const { error } = await supabase.from('centros_costo_config').delete().eq('id', configId)
  if (error) return { ok: false, message: error.message }
  return { ok: true, message: 'Centro de costo deshabilitado.' }
}

// ─────────────────────────────────────────────────────────────────────────────
// listarConfigsCliente — client-side: get their enabled cost center configs
// ─────────────────────────────────────────────────────────────────────────────

export async function listarConfigsCliente(
  clienteId: string,
): Promise<{ ok: boolean; data: CentroCostoConfig[]; message?: string }> {
  const supabase = await createClient()
  const { effectiveUserId } = await getEffectiveUserId(supabase)
  if (!effectiveUserId) return { ok: false, data: [], message: 'Sesión expirada.' }

  const { data, error } = await supabase
    .from('centros_costo_config')
    .select('id, cliente_id, tipo_tabla, tabla_id, tabla_nombre_real, label, col_codigo, col_nombre, cols_extra, activo, orden, tabla:dynamic_tables(name, module:modules(name))')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .order('orden', { ascending: true })
    .order('label', { ascending: true })

  if (error) return { ok: false, data: [], message: error.message }

  const mapped = (data ?? []).map((row) => {
    const tabla = row.tabla as { name?: string; module?: { name?: string } } | null
    return {
      id: row.id,
      cliente_id: row.cliente_id,
      tipo_tabla: (row.tipo_tabla ?? 'dynamic') as 'dynamic' | 'native',
      tabla_id: row.tabla_id ?? null,
      tabla_nombre_real: row.tabla_nombre_real ?? null,
      label: row.label,
      col_codigo: row.col_codigo,
      col_nombre: row.col_nombre,
      cols_extra: row.cols_extra ?? '',
      activo: row.activo,
      orden: row.orden,
      tabla_nombre: tabla?.name ?? row.tabla_nombre_real ?? '',
      modulo_nombre: tabla?.module?.name ?? '',
    } as CentroCostoConfig
  })

  return { ok: true, data: mapped }
}

// ─────────────────────────────────────────────────────────────────────────────
// buscarEnTabla — queries rows from either dynamic_table_rows OR a native table
// ─────────────────────────────────────────────────────────────────────────────

export async function buscarEnTabla(
  config: CentroCostoConfig,
  clienteId: string,
  query = '',
  page = 0,
  pageSize = 30,
): Promise<{ ok: boolean; filas: FilaTabla[]; total: number; message?: string }> {
  const supabase = await createClient()
  const { effectiveUserId } = await getEffectiveUserId(supabase)
  if (!effectiveUserId) return { ok: false, filas: [], total: 0, message: 'Sesión expirada.' }

  const q = query.toLowerCase().trim()

  if (config.tipo_tabla === 'native' && config.tabla_nombre_real) {
    return buscarEnTablaNativa(supabase, config, clienteId, q, page, pageSize)
  }

  // Dynamic table_rows
  if (!config.tabla_id) return { ok: false, filas: [], total: 0, message: 'Configuración inválida.' }

  // Fetch column definitions to build id → name map
  // (dynamic_table_rows stores data with column.id as key, not column.name)
  const { data: tableDef } = await supabase
    .from('dynamic_tables')
    .select('columns')
    .eq('id', config.tabla_id)
    .single()

  const colDefs = (tableDef?.columns ?? []) as { id: string; name: string }[]
  const idToName: Record<string, string> = {}
  const nameToId: Record<string, string> = {}
  for (const col of colDefs) {
    if (col.id && col.name) {
      idToName[col.id] = col.name
      nameToId[col.name] = col.id
    }
  }

  // Helper: resolve col_codigo / col_nombre / cols_extra (stored as names) to data keys
  const resolveKey = (nameOrId: string): string => nameToId[nameOrId] ?? nameOrId

  const { data, error, count } = await supabase
    .from('dynamic_table_rows')
    .select('id, data', { count: 'exact' })
    .eq('table_id', config.tabla_id)
    .order('row_order', { ascending: true })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (error) return { ok: false, filas: [], total: 0, message: error.message }

  let filas: FilaTabla[] = (data ?? []).map((row) => {
    const rawData = (row.data ?? {}) as Record<string, unknown>

    // Re-key the JSONB using column names so client code can use config column names
    const d: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(rawData)) {
      const name = idToName[k] ?? k
      d[name] = v
    }

    return {
      row_id: row.id as string,
      data: d,
      codigo: String(d[config.col_codigo] ?? rawData[resolveKey(config.col_codigo)] ?? row.id ?? ''),
      nombre: config.col_nombre
        ? String(d[config.col_nombre] ?? rawData[resolveKey(config.col_nombre)] ?? '')
        : '',
    }
  })

  if (q) {
    filas = filas.filter((f) => f.codigo.toLowerCase().includes(q) || f.nombre.toLowerCase().includes(q))
  }

  return { ok: true, filas, total: count ?? 0 }
}

// ─────────────────────────────────────────────────────────────────────────────
// buscarEnTablaNativa — queries real Supabase tables (inventory_materials, etc.)
// Only tables registered in NATIVE_MODULES are allowed (whitelist).
// ─────────────────────────────────────────────────────────────────────────────

async function buscarEnTablaNativa(
  supabase: Awaited<ReturnType<typeof createClient>>,
  config: CentroCostoConfig,
  clienteId: string,
  q: string,
  page: number,
  pageSize: number,
): Promise<{ ok: boolean; filas: FilaTabla[]; total: number; message?: string }> {
  const tabla = config.tabla_nombre_real!

  if (!ALLOWED_NATIVE_TABLES.has(tabla)) {
    return { ok: false, filas: [], total: 0, message: `Tabla "${tabla}" no permitida.` }
  }

  // Find the native def to know which filter column to use
  const nativeDef = Object.values(NATIVE_MODULES).flat().find((d) => d.tabla === tabla)
  if (!nativeDef) return { ok: false, filas: [], total: 0, message: 'Definición no encontrada.' }

  // Extra columns to select
  const extraCols = config.cols_extra
    ? config.cols_extra.split(',').map((c) => c.trim()).filter(Boolean)
    : nativeDef.cols_extra

  const selectCols = ['id', config.col_codigo, config.col_nombre, ...extraCols]
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .join(', ')

  let req = (supabase.from(tabla) as ReturnType<typeof supabase.from>)
    .select(selectCols, { count: 'exact' })
    .eq(nativeDef.col_filter, clienteId)
    .order(config.col_codigo, { ascending: true })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  // Filter active rows if the table has is_active column
  if (['inventory_materials', 'inventory_warehouses'].includes(tabla)) {
    req = req.eq('is_active', true)
  }

  const { data, error, count } = await req

  if (error) return { ok: false, filas: [], total: 0, message: error.message }

  let filas: FilaTabla[] = (data ?? []).map((row: Record<string, unknown>) => {
    const codigo = String(row[config.col_codigo] ?? row.id ?? '')
    const nombre = config.col_nombre ? String(row[config.col_nombre] ?? '') : ''
    return {
      row_id: String(row.id),
      data: row,
      codigo,
      nombre,
    }
  })

  if (q) {
    filas = filas.filter((f) => f.codigo.toLowerCase().includes(q) || f.nombre.toLowerCase().includes(q))
  }

  return { ok: true, filas, total: count ?? 0 }
}

// -----------------------------------------------------------------------------
// fetchFilasParaAsignaciones
// Batch-fetches FRESH row data for a list of {config_id, row_id} pairs.
// Used by analisis.ts and clasificacion.ts to enrich cost center display
// with the actual picker columns (cols_extra, col_codigo, col_nombre).
// -----------------------------------------------------------------------------

export interface FilaEnriquecida {
  cols_extra: string[]
  extra_data: Record<string, unknown>
  codigo: string
  nombre: string
}

export async function fetchFilasParaAsignaciones(
  supabase: Awaited<ReturnType<typeof createClient>>,
  items: Array<{ config_id: string; row_id: string }>,
): Promise<Map<string, FilaEnriquecida>> {
  const result = new Map<string, FilaEnriquecida>()
  if (!items.length) return result

  const configIds = [...new Set(items.map((i) => i.config_id).filter(Boolean))]
  if (!configIds.length) return result

  const { data: configs } = await supabase
    .from('centros_costo_config')
    .select('id, tipo_tabla, tabla_id, tabla_nombre_real, col_codigo, col_nombre, cols_extra')
    .in('id', configIds)

  if (!configs?.length) return result

  const configMap = new Map(configs.map((c) => [c.id as string, c]))

  const byConfig = new Map<string, string[]>()
  for (const item of items) {
    if (!item.config_id || !item.row_id) continue
    const list = byConfig.get(item.config_id) ?? []
    list.push(item.row_id)
    byConfig.set(item.config_id, list)
  }

  for (const [configId, rowIds] of byConfig.entries()) {
    const cfg = configMap.get(configId)
    if (!cfg) continue

    const extraColsList: string[] = cfg.cols_extra
      ? String(cfg.cols_extra).split(',').map((c: string) => c.trim()).filter(Boolean)
      : []

    if (cfg.tipo_tabla === 'dynamic' && cfg.tabla_id) {
      const { data: tableDef } = await supabase
        .from('dynamic_tables')
        .select('columns')
        .eq('id', cfg.tabla_id)
        .single()

      const colDefs = (tableDef?.columns ?? []) as { id: string; name: string }[]
      const idToName: Record<string, string> = {}
      const nameToId: Record<string, string> = {}
      for (const col of colDefs) {
        if (col.id && col.name) { idToName[col.id] = col.name; nameToId[col.name] = col.id }
      }
      const resolveKey = (n: string) => nameToId[n] ?? n

      const { data: rows } = await supabase
        .from('dynamic_table_rows')
        .select('id, data')
        .eq('table_id', cfg.tabla_id)
        .in('id', rowIds)

      for (const row of rows ?? []) {
        const raw = (row.data ?? {}) as Record<string, unknown>
        const d: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(raw)) d[idToName[k] ?? k] = v

        result.set(String(row.id), {
          cols_extra: extraColsList,
          extra_data: d,
          codigo: String(d[cfg.col_codigo] ?? raw[resolveKey(cfg.col_codigo)] ?? row.id ?? ''),
          nombre: cfg.col_nombre
            ? String(d[cfg.col_nombre] ?? raw[resolveKey(cfg.col_nombre)] ?? '')
            : '',
        })
      }
    } else if (cfg.tipo_tabla === 'native' && cfg.tabla_nombre_real) {
      if (!ALLOWED_NATIVE_TABLES.has(cfg.tabla_nombre_real)) continue

      const selectCols = ['id', cfg.col_codigo, cfg.col_nombre, ...extraColsList]
        .filter((v: string, i: number, a: string[]) => Boolean(v) && a.indexOf(v) === i)
        .join(', ')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rows } = await (supabase.from(cfg.tabla_nombre_real) as any)
        .select(selectCols)
        .in('id', rowIds)

      for (const row of (rows ?? []) as Record<string, unknown>[]) {
        result.set(String(row.id), {
          cols_extra: extraColsList,
          extra_data: row,
          codigo: String(row[cfg.col_codigo] ?? row.id ?? ''),
          nombre: cfg.col_nombre ? String(row[cfg.col_nombre] ?? '') : '',
        })
      }
    }
  }

  return result
}

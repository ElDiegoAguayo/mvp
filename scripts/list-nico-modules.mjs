import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const raw = readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '')
for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq === -1) continue
  const key = trimmed.slice(0, eq).trim()
  let val = trimmed.slice(eq + 1).trim()
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1)
  }
  process.env[key] = val
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EMAIL = 'nico@upcrop-ia'

const { data: profile } = await sb.from('profiles').select('id').eq('email', EMAIL).single()
if (!profile) {
  console.error('No profile')
  process.exit(1)
}

const uid = profile.id

const { data: access } = await sb
  .from('user_module_access')
  .select('modules:module_id(slug, name)')
  .eq('user_id', uid)
  .eq('enabled', true)

const slugs = (access ?? []).map((a) => a.modules).filter(Boolean)

const checks = {
  'estimacion-cosecha / plan-de-cosecha': async () => {
    const { count } = await sb.from('harvest_estimates').select('*', { count: 'exact', head: true }).eq('user_id', uid)
    return count > 0
  },
  'estados-fenologicos': async () => {
    const { count } = await sb.from('phenology_observations').select('*', { count: 'exact', head: true }).eq('user_id', uid)
    return count > 0
  },
  'costos-y-gastos': async () => {
    const { count } = await sb.from('registro_compras_sii').select('*', { count: 'exact', head: true }).eq('cliente_id', uid)
    return count > 0
  },
  'produccion / planificacion': async () => {
    const { count } = await sb.from('recetas_embalaje').select('*', { count: 'exact', head: true }).eq('cliente_id', uid)
    return count > 0
  },
  inventario: async () => {
    const { count } = await sb.from('inventory_materials').select('*', { count: 'exact', head: true }).eq('user_id', uid)
    return count > 0
  },
  'boveda-documental': async () => {
    const { count } = await sb.from('carpetas').select('*', { count: 'exact', head: true }).eq('user_id', uid)
    return count > 0
  },
  mercado: async () => false,
  inicio: async () => false,
}

function matchCheck(slug, name) {
  const s = `${slug} ${name}`.toLowerCase()
  if (s.includes('estimacion') || s.includes('plan-de-cosecha') || s.includes('plan de cosecha') || s.includes('cosecha')) return 'estimacion-cosecha / plan-de-cosecha'
  if (s.includes('fenolog')) return 'estados-fenologicos'
  if (s.includes('costo') || s.includes('gasto')) return 'costos-y-gastos'
  if (s.includes('produccion') || s.includes('producción') || s.includes('planificacion') || s.includes('embalaje')) return 'produccion / planificacion'
  if (s.includes('inventario')) return 'inventario'
  if (s.includes('boveda') || s.includes('bóveda')) return 'boveda-documental'
  if (s.includes('mercado')) return 'mercado'
  if (s.includes('inicio')) return 'inicio'
  return null
}

console.log(`Modulos habilitados para ${EMAIL}:\n`)

for (const mod of slugs) {
  const { data: tables } = await sb
    .from('dynamic_tables')
    .select('id')
    .eq('user_id', uid)
    .eq('module_id', (await sb.from('modules').select('id').eq('slug', mod.slug).single()).data?.id)

  const { count: rows } = await sb
    .from('dynamic_table_rows')
    .select('*', { count: 'exact', head: true })
    .in('table_id', (tables ?? []).map((t) => t.id))

  const { count: charts } = await sb
    .from('dynamic_charts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', uid)
    .eq('module_id', (await sb.from('modules').select('id').eq('slug', mod.slug).single()).data?.id)

  const key = matchCheck(mod.slug, mod.name)
  let native = key ? await checks[key]?.() : null

  const status =
    mod.slug === 'mercado' || mod.name?.toLowerCase().includes('mercado')
      ? 'mock UI (sin BD)'
      : mod.slug === 'inicio'
        ? 'widgets API / layout (sin seed)'
        : (tables?.length ?? 0) > 0
          ? `${tables.length} tabla(s), ${rows ?? 0} filas, ${charts ?? 0} gráficos`
          : native
            ? 'datos nativos OK'
            : 'SIN DATOS'

  console.log(`• ${mod.name} (${mod.slug})`)
  console.log(`  → ${status}\n`)
}

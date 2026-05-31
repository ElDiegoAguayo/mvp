export interface ModuleArea {
  id: string
  name: string
  display_order: number
}

export interface ModuleWithArea {
  id: string
  area_id?: string | null
  area?: ModuleArea | null
}

export const FALLBACK_MODULE_AREA: ModuleArea = {
  id: '__general__',
  name: 'General',
  display_order: 9999,
}

export function resolveModuleArea(
  module: ModuleWithArea,
  areasById?: Map<string, ModuleArea>,
): ModuleArea {
  if (module.area?.name) return module.area
  if (module.area_id && areasById?.has(module.area_id)) {
    return areasById.get(module.area_id)!
  }
  return FALLBACK_MODULE_AREA
}

/** Rellena `module.area` desde `area_id` cuando el join no vino en la query. */
export function hydrateModuleArea<T extends ModuleWithArea>(
  module: T,
  areasById: Map<string, ModuleArea>,
): T {
  if (module.area?.name) return module
  if (module.area_id && areasById.has(module.area_id)) {
    return { ...module, area: areasById.get(module.area_id)! }
  }
  return module
}

export function compareModulesByAreaThenName<T extends ModuleWithArea & { name: string }>(
  a: T,
  b: T,
  orderMap?: Map<string, number>,
): number {
  const areaA = resolveModuleArea(a)
  const areaB = resolveModuleArea(b)
  if (areaA.display_order !== areaB.display_order) {
    return areaA.display_order - areaB.display_order
  }
  if (areaA.name !== areaB.name) {
    return areaA.name.localeCompare(areaB.name, 'es')
  }
  const orderA = orderMap?.get(a.id) ?? 0
  const orderB = orderMap?.get(b.id) ?? 0
  if (orderA !== orderB) return orderA - orderB
  return a.name.localeCompare(b.name, 'es')
}

export function groupModulesByArea<T extends ModuleWithArea & { name: string }>(
  modules: T[],
  orderMap?: Map<string, number>,
): Array<{ area: ModuleArea; modules: T[] }> {
  const sorted = [...modules].sort((a, b) => compareModulesByAreaThenName(a, b, orderMap))
  const groups: Array<{ area: ModuleArea; modules: T[] }> = []

  for (const mod of sorted) {
    const area = resolveModuleArea(mod)
    const last = groups[groups.length - 1]
    if (last && last.area.id === area.id) {
      last.modules.push(mod)
    } else {
      groups.push({ area, modules: [mod] })
    }
  }

  return groups
}

/** Visual grouping hints for tables (admin permissions matrix). */
export type ModuleAreaCellMeta = {
  firstInArea: Set<string>
  lastInArea: Set<string>
  areaTintClass: Map<string, string>
  areaHeaderTintClass: Map<string, string>
}

const MODULE_AREA_TINTS = [
  'bg-sky-500/[0.07]',
  'bg-violet-500/[0.07]',
  'bg-amber-500/[0.07]',
  'bg-emerald-500/[0.07]',
  'bg-rose-500/[0.07]',
  'bg-orange-500/[0.07]',
  'bg-cyan-500/[0.07]',
  'bg-slate-500/[0.07]',
] as const

const MODULE_AREA_HEADER_TINTS = [
  'bg-sky-500/25',
  'bg-violet-500/25',
  'bg-amber-500/25',
  'bg-emerald-500/25',
  'bg-rose-500/25',
  'bg-orange-500/25',
  'bg-cyan-500/25',
  'bg-slate-500/25',
] as const

export function buildModuleAreaCellMeta<T extends { id: string }>(
  groups: Array<{ area: ModuleArea; modules: T[] }>,
): ModuleAreaCellMeta {
  const firstInArea = new Set<string>()
  const lastInArea = new Set<string>()
  const areaTintClass = new Map<string, string>()
  const areaHeaderTintClass = new Map<string, string>()

  groups.forEach((group, groupIndex) => {
    const tint = MODULE_AREA_TINTS[groupIndex % MODULE_AREA_TINTS.length]
    const headerTint = MODULE_AREA_HEADER_TINTS[groupIndex % MODULE_AREA_HEADER_TINTS.length]
    areaHeaderTintClass.set(group.area.id, headerTint)

    group.modules.forEach((mod, moduleIndex) => {
      areaTintClass.set(mod.id, tint)
      if (moduleIndex === 0) firstInArea.add(mod.id)
      if (moduleIndex === group.modules.length - 1) lastInArea.add(mod.id)
    })
  })

  return { firstInArea, lastInArea, areaTintClass, areaHeaderTintClass }
}

export function moduleAreaCellClassName(
  moduleId: string,
  meta: ModuleAreaCellMeta,
  extra?: string,
): string {
  const parts = [meta.areaTintClass.get(moduleId)]
  if (meta.firstInArea.has(moduleId)) {
    parts.push('border-l-[3px] border-l-border')
  }
  if (meta.lastInArea.has(moduleId)) {
    parts.push('border-r-2 border-r-border/80')
  }
  if (extra) parts.push(extra)
  return parts.filter(Boolean).join(' ')
}

export const MODULE_AREA_SELECT =
  'id, name, display_order' as const

export const MODULE_WITH_AREA_SELECT =
  'id, slug, name, icon, color, text_color, icon_shape, icon_size, icon_style, menu_badge, description, is_active, is_core, embed_url, area_id, area:module_areas(id, name, display_order)' as const

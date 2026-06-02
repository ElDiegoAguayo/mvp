export const TECH_ASSISTANCE_MODULE_SLUG = 'asistencia-tecnica'
export const PHENOLOGY_MODULE_SLUG = 'estados-fenologicos'
export const INSPECTOR_HARVEST_COUNT_MODULE_SLUG = 'estimacion-cosecha'

/** Modules field inspectors may access (DB trigger must stay in sync). */
export const INSPECTOR_ALLOWED_MODULE_SLUGS = [
  TECH_ASSISTANCE_MODULE_SLUG,
  PHENOLOGY_MODULE_SLUG,
  INSPECTOR_HARVEST_COUNT_MODULE_SLUG,
] as const

export const INSPECTOR_MODULE_ACCESS_MESSAGE =
  'Los inspectores solo pueden tener Asistencia técnica, Estados fenológicos y Estimación de cosecha (conteo)'

export type InspectorAllowedModuleSlug = (typeof INSPECTOR_ALLOWED_MODULE_SLUGS)[number]

export function isInspectorAllowedModule(module: { slug: string }): boolean {
  return (INSPECTOR_ALLOWED_MODULE_SLUGS as readonly string[]).includes(module.slug)
}

export function isTechAssistanceModule(module: { slug: string }): boolean {
  return module.slug === TECH_ASSISTANCE_MODULE_SLUG
}

/** null = normal user; locked-on/off = inspector row */
export function inspectorModuleCellState(
  user: { is_tech_inspector?: boolean | null },
  module: { slug: string },
): 'locked-on' | 'locked-off' | null {
  if (!user.is_tech_inspector) return null
  return isInspectorAllowedModule(module) ? 'locked-on' : 'locked-off'
}

export function isInspectorModuleSwitchDisabled(
  user: { is_tech_inspector?: boolean | null },
  module: { slug: string },
): boolean {
  return inspectorModuleCellState(user, module) !== null
}

export function inspectorModuleSwitchTitle(
  user: { is_tech_inspector?: boolean | null },
  module: { slug: string },
): string | undefined {
  if (!user.is_tech_inspector) return undefined
  if (isInspectorAllowedModule(module)) {
    return 'Módulo obligatorio para inspectores de campo'
  }
  return INSPECTOR_MODULE_ACCESS_MESSAGE
}

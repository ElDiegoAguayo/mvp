export const TECH_ASSISTANCE_MODULE_SLUG = 'asistencia-tecnica'

export function isTechAssistanceModule(module: { slug: string }): boolean {
  return module.slug === TECH_ASSISTANCE_MODULE_SLUG
}

/** null = normal user; locked-on/off = inspector row */
export function inspectorModuleCellState(
  user: { is_tech_inspector?: boolean | null },
  module: { slug: string },
): 'locked-on' | 'locked-off' | null {
  if (!user.is_tech_inspector) return null
  return isTechAssistanceModule(module) ? 'locked-on' : 'locked-off'
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
  if (isTechAssistanceModule(module)) {
    return 'Único módulo permitido para inspectores de campo'
  }
  return 'Los inspectores solo pueden usar Asistencia técnica'
}

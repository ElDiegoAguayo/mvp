export type TechAssistanceProfile = {
  role?: string | null
  parent_user_id?: string | null
  is_tech_inspector?: boolean | null
  full_name?: string | null
  email?: string | null
}

export function isTechInspectorProfile(profile: TechAssistanceProfile | null | undefined): boolean {
  return profile?.role === 'user' && !!profile?.is_tech_inspector
}

export function inspectorDisplayName(profile: TechAssistanceProfile | null | undefined): string {
  return profile?.full_name?.trim() || profile?.email?.trim() || 'Inspector'
}

/** Admin Up Crop: servicios, proformas, corrección de registros. */
export function isTechAssistanceAdmin(isAdmin: boolean): boolean {
  return isAdmin
}

/** Inspector en campo: marcar asistencia GPS. */
export function canCreateTechEntry(isAdmin: boolean, isInspector: boolean): boolean {
  return isAdmin || isInspector
}

/** Admin: editar/eliminar registros abiertos (corrección). Inspector: solo los suyos. */
export function canCorrectTechEntry(isAdmin: boolean, isInspector: boolean): boolean {
  return isAdmin || isInspector
}

/** Admin: catálogo de servicios y precios. */
export function canManageTechServices(isAdmin: boolean): boolean {
  return isAdmin
}

/** Admin: generar y enviar proformas. */
export function canGenerateTechProforma(isAdmin: boolean): boolean {
  return isAdmin
}

/** Cliente principal: aprobar o rechazar proformas pendientes. */
export function canApproveTechProforma(
  profile: TechAssistanceProfile | null | undefined,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true
  if (!profile || profile.role !== 'user') return false
  if (isTechInspectorProfile(profile)) return false
  if (profile.parent_user_id) return false
  return true
}

/** @deprecated Use granular helpers above. Kept for legacy imports. */
export function canManageTechAssistance(
  profile: TechAssistanceProfile | null | undefined,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true
  if (!profile || profile.role !== 'user') return false
  if (isTechInspectorProfile(profile)) return false
  return true
}

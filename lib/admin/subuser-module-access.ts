type AccessMap = Record<string, boolean>

export function moduleAccessKey(userId: string, moduleId: string): string {
  return `${userId}:${moduleId}`
}

export function isModuleEnabledForUser(
  access: AccessMap,
  userId: string,
  moduleId: string,
): boolean {
  return !!access[moduleAccessKey(userId, moduleId)]
}

export function parentHasModuleEnabled(
  access: AccessMap,
  parentUserId: string | null | undefined,
  moduleId: string,
): boolean {
  if (!parentUserId) return true
  return isModuleEnabledForUser(access, parentUserId, moduleId)
}

export function canEnableSubuserModule(
  access: AccessMap,
  parentUserId: string | null | undefined,
  moduleId: string,
): boolean {
  return parentHasModuleEnabled(access, parentUserId, moduleId)
}

/** Subusers can disable any assigned module; enabling requires the parent to have it active. */
export function isSubuserModuleSwitchDisabled(
  access: AccessMap,
  user: { parent_user_id?: string | null; is_active?: boolean },
  moduleId: string,
  isChecked: boolean,
): boolean {
  if (!user.is_active) return true
  if (!user.parent_user_id) return false
  if (isChecked) return false
  return !canEnableSubuserModule(access, user.parent_user_id, moduleId)
}

export function subuserModuleSwitchTitle(
  access: AccessMap,
  user: { parent_user_id?: string | null },
  moduleId: string,
  isChecked: boolean,
): string | undefined {
  if (!user.parent_user_id || isChecked) return undefined
  if (canEnableSubuserModule(access, user.parent_user_id, moduleId)) return undefined
  return 'El cliente principal no tiene este módulo activo'
}

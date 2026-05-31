/** Fields needed to identify a principal client (not subuser, not field inspector). */
export type PrincipalClientProfileFields = {
  role?: string | null
  parent_user_id?: string | null
  is_tech_inspector?: boolean | null
}

/** Principal client = role user, no parent, not a field inspector. */
export function isPrincipalClientProfile(
  profile: PrincipalClientProfileFields,
): boolean {
  return (
    profile.role === 'user' &&
    !profile.parent_user_id &&
    profile.is_tech_inspector !== true
  )
}

/** Apply standard Supabase filters for principal client listing queries. */
export function applyPrincipalClientFilters<Q extends {
  eq: (column: string, value: unknown) => Q
  is: (column: string, value: null) => Q
}>(query: Q): Q {
  return query
    .eq('role', 'user')
    .is('parent_user_id', null)
    .eq('is_tech_inspector', false)
}

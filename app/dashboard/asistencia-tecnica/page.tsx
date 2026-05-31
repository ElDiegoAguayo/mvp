import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ModuleViewTracker } from '@/components/dashboard/module-view-tracker'
import { type TechAssistanceClientOption } from '@/components/dashboard/asistencia-tecnica/tech-assistance-manager'
import { TechAssistanceAdminView } from '@/components/dashboard/asistencia-tecnica/tech-assistance-admin-view'
import { TechAssistanceClientView } from '@/components/dashboard/asistencia-tecnica/tech-assistance-client-view'
import { TechAssistanceInspectorView } from '@/components/dashboard/asistencia-tecnica/tech-assistance-inspector-view'
import { TechAssistancePageHeader } from '@/components/dashboard/asistencia-tecnica/tech-assistance-page-header'
import {
  canApproveTechProforma,
  inspectorDisplayName,
  isTechInspectorProfile,
} from '@/lib/tech-assistance/roles'
import { getEffectiveUserId } from '@/lib/supabase/effective-user-server'
import { getViewAsContext } from '@/lib/impersonation'
import { applyPrincipalClientFilters } from '@/lib/profiles/principal-clients'

export const dynamic = 'force-dynamic'

const MODULE_SLUG = 'asistencia-tecnica'

export default async function AsistenciaTecnicaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email, is_tech_inspector, parent_user_id')
    .eq('id', user.id)
    .single()

  const { userId: actingUserId } = await getEffectiveUserId(supabase)
  const effectiveUserId = actingUserId ?? user.id

  const { data: actingProfile } = await supabase
    .from('profiles')
    .select('role, full_name, email, is_tech_inspector, parent_user_id')
    .eq('id', effectiveUserId)
    .single()

  const viewAs = await getViewAsContext()
  const isSupportMode = !!viewAs.viewAsUserId

  const loggedInIsAdmin = profile?.role === 'admin'
  const isInspector = isTechInspectorProfile(actingProfile)
  // En modo soporte se muestra la vista del usuario impersonado (cliente o inspector), no admin.
  const isAdminView = loggedInIsAdmin && !isInspector && !isSupportMode

  const { data: access } = await supabase
    .from('user_module_access')
    .select('enabled, modules:module_id (slug)')
    .eq('user_id', user.id)
    .eq('enabled', true)

  type AccessRow = { enabled: boolean; modules: { slug: string } | null }
  const hasAccess =
    loggedInIsAdmin ||
    ((access ?? []) as unknown as AccessRow[]).some(a => a.modules?.slug === MODULE_SLUG)

  if (!hasAccess) redirect('/dashboard')

  const { data: mod } = await supabase
    .from('modules')
    .select('id, name, slug')
    .eq('slug', MODULE_SLUG)
    .maybeSingle()

  let clients: TechAssistanceClientOption[] = []
  if (isAdminView) {
    const { data: clientRows } = await applyPrincipalClientFilters(
      supabase.from('profiles').select('id, full_name, email'),
    ).order('full_name')

    clients = (clientRows ?? []).map(c => ({
      id: c.id,
      label: c.full_name?.trim() || c.email || c.id,
    }))
  }

  const canApprove = canApproveTechProforma(actingProfile ?? profile, isAdminView)

  const pageRole = isInspector ? 'inspector' : isAdminView ? 'admin' : 'client'

  return (
    <>
      {mod && (
        <ModuleViewTracker moduleId={mod.id} moduleSlug={mod.slug} moduleName={mod.name} />
      )}
      <TechAssistancePageHeader role={pageRole} />
      {isInspector ? (
        <TechAssistanceInspectorView
          inspectorName={inspectorDisplayName(actingProfile ?? profile)}
          userId={effectiveUserId}
        />
      ) : isAdminView ? (
        <TechAssistanceAdminView clients={clients} />
      ) : (
        <TechAssistanceClientView canApproveProformas={canApprove} />
      )}
    </>
  )
}

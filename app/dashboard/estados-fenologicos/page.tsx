import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PhenologicalStatesManager } from '@/components/dashboard/phenological-states-manager'
import { PhenologyPageHeader } from '@/components/dashboard/phenology-page-header'
import { ModuleViewTracker } from '@/components/dashboard/module-view-tracker'
import { userCanAccessModuleBySlug } from '@/lib/dashboard/module-access'

export const dynamic = 'force-dynamic'

const MODULE_SLUG = 'estados-fenologicos'

export default async function EstadosFenologicosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const hasAccess = await userCanAccessModuleBySlug(supabase, user.id, MODULE_SLUG)
  if (!hasAccess) redirect('/dashboard')

  const { data: mod } = await supabase
    .from('modules')
    .select('id, name, slug')
    .eq('slug', MODULE_SLUG)
    .maybeSingle()

  return (
    <>
      {mod && (
        <ModuleViewTracker moduleId={mod.id} moduleSlug={mod.slug} moduleName={mod.name} />
      )}
      <PhenologyPageHeader />
      <PhenologicalStatesManager />
    </>
  )
}

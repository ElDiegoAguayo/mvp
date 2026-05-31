import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PhenologicalStatesManager } from '@/components/dashboard/phenological-states-manager'
import { PhenologyPageHeader } from '@/components/dashboard/phenology-page-header'
import { ModuleViewTracker } from '@/components/dashboard/module-view-tracker'

export const dynamic = 'force-dynamic'

const MODULE_SLUG = 'estados-fenologicos'

export default async function EstadosFenologicosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: access } = await supabase
    .from('user_module_access')
    .select('enabled, modules:module_id (slug)')
    .eq('user_id', user.id)
    .eq('enabled', true)

  type AccessRow = { enabled: boolean; modules: { slug: string } | null }
  const hasAccess = ((access ?? []) as unknown as AccessRow[]).some(
    (a) => a.modules?.slug === MODULE_SLUG,
  )
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

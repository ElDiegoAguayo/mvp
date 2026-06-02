import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HarvestEstimationManager } from '@/components/dashboard/harvest-estimation-manager'
import { HarvestEstimationPageHeader } from '@/components/dashboard/harvest-estimation-page-header'
import { ModuleViewTracker } from '@/components/dashboard/module-view-tracker'
import { userCanAccessModuleBySlug } from '@/lib/dashboard/module-access'

export const dynamic = 'force-dynamic'

const MODULE_SLUG = 'estimacion-cosecha'

export default async function EstimacionCosechaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const initialTab =
    tab === 'plan' ? 'plan' as const
    : tab === 'estimacion' ? 'estimacion' as const
    : 'conteo' as const

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
      <HarvestEstimationPageHeader />
      <HarvestEstimationManager initialTab={initialTab} />
    </>
  )
}

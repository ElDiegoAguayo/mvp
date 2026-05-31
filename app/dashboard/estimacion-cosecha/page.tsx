import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HarvestEstimationManager } from '@/components/dashboard/harvest-estimation-manager'
import { HarvestEstimationPageHeader } from '@/components/dashboard/harvest-estimation-page-header'
import { ModuleViewTracker } from '@/components/dashboard/module-view-tracker'

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
      <HarvestEstimationPageHeader />
      <HarvestEstimationManager initialTab={initialTab} />
    </>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HarvestEstimationManager } from '@/components/dashboard/harvest-estimation-manager'
import { ModuleViewTracker } from '@/components/dashboard/module-view-tracker'
import { BarChart3 } from 'lucide-react'

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
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Estimación de cosecha</h1>
            <p className="text-sm text-muted-foreground">
              Conteos fenológicos, estimación de kg y plan de cosecha por cuartel — personalizado por cliente.
            </p>
          </div>
        </div>
      </div>
      <HarvestEstimationManager initialTab={initialTab} />
    </>
  )
}

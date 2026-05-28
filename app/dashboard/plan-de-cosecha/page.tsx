import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HarvestPlanManager } from '@/components/dashboard/harvest-plan/harvest-plan-manager'
import { ModuleViewTracker } from '@/components/dashboard/module-view-tracker'
import { isHarvestPlanModule } from '@/lib/dashboard/harvest-plan-module'
import { CalendarRange } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlanDeCosechaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: access } = await supabase
    .from('user_module_access')
    .select('enabled, modules:module_id (id, slug, name)')
    .eq('user_id', user.id)
    .eq('enabled', true)

  type AccessRow = {
    enabled: boolean
    modules: { id: string; slug: string; name: string } | null
  }
  const accessRows = (access ?? []) as unknown as AccessRow[]
  const mod = accessRows
    .map((a) => a.modules)
    .find((m) => m && isHarvestPlanModule(m.slug, m.name))

  if (!mod) redirect('/dashboard')

  return (
    <>
      <ModuleViewTracker moduleId={mod.id} moduleSlug={mod.slug} moduleName={mod.name} />
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <CalendarRange className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{mod.name}</h1>
            <p className="text-sm text-muted-foreground">
              Calendario y ventanas esperadas por cuartel — conecta estimación de kg y fenología.
            </p>
          </div>
        </div>
      </div>
      <HarvestPlanManager />
    </>
  )
}

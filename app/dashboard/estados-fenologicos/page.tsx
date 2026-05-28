import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PhenologicalStatesManager } from '@/components/dashboard/phenological-states-manager'
import { ModuleViewTracker } from '@/components/dashboard/module-view-tracker'
import { Sprout } from 'lucide-react'

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
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-lime-500/10 border border-lime-500/20 flex items-center justify-center">
            <Sprout className="w-6 h-6 text-lime-600 dark:text-lime-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Estados fenológicos</h1>
            <p className="text-sm text-muted-foreground">
              Seguimiento semanal por cuartel al estilo San Mariano — con fotos de campo por semana.
            </p>
          </div>
        </div>
      </div>
      <PhenologicalStatesManager />
    </>
  )
}

import { PhytoStockManager } from '@/components/dashboard/fitosanitario/phyto-stock-manager'
import { ModuleViewTracker } from '@/components/dashboard/module-view-tracker'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PhytoStockPage() {
  const supabase = await createClient()
  const { data: mod } = await supabase
    .from('modules')
    .select('id, name, slug')
    .eq('slug', 'inventario-fitosanitario')
    .maybeSingle()

  return (
    <>
      {mod && (
        <ModuleViewTracker moduleId={mod.id} moduleSlug={mod.slug} moduleName={mod.name} />
      )}
      <PhytoStockManager />
    </>
  )
}

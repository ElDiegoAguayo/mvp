import { createClient } from '@/lib/supabase/server'
import { QuotationsManager } from '@/components/dashboard/proveedores/quotations-manager'
import { ModuleViewTracker } from '@/components/dashboard/module-view-tracker'

export const dynamic = 'force-dynamic'

export default async function ProveedoresCotizacionesPage() {
  const supabase = await createClient()
  const { data: mod } = await supabase
    .from('modules')
    .select('id, name, slug')
    .eq('slug', 'proveedores')
    .maybeSingle()

  return (
    <>
      {mod && (
        <ModuleViewTracker
          moduleId={mod.id}
          moduleSlug={mod.slug}
          moduleName={mod.name}
        />
      )}
      <QuotationsManager />
    </>
  )
}

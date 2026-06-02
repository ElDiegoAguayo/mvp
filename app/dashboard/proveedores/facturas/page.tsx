import { createClient } from '@/lib/supabase/server'
import { PurchaseInvoicesManager } from '@/components/dashboard/proveedores/purchase-invoices-manager'
import { ModuleViewTracker } from '@/components/dashboard/module-view-tracker'

export const dynamic = 'force-dynamic'

export default async function ProveedoresFacturasPage() {
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
      <PurchaseInvoicesManager />
    </>
  )
}

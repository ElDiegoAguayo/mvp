import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDataOwnerId } from '@/lib/supabase/effective-user-server'
import { AnalisisCostosView } from '@/components/dashboard/costos-y-gastos/analisis-costos-view'
import { CostosWorkflowStepper } from '@/components/dashboard/costos-y-gastos/costos-workflow-stepper'
import { CentroDeCostosIntro } from '@/components/dashboard/costos-y-gastos/centro-de-costos-intro'

export const dynamic = 'force-dynamic'

export default async function CentroDeCostosPage() {
  const supabase = await createClient()
  const ownerId = await getDataOwnerId(supabase)
  if (!ownerId) redirect('/auth/login')

  return (
    <div className="space-y-6">
      <CostosWorkflowStepper clienteId={ownerId} />
      <CentroDeCostosIntro />
      <AnalisisCostosView clienteId={ownerId} />
    </div>
  )
}

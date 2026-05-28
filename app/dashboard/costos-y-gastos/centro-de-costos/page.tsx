import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDataOwnerId } from '@/lib/supabase/effective-user-server'
import { AnalisisCostosView } from '@/components/dashboard/costos-y-gastos/analisis-costos-view'

export const dynamic = 'force-dynamic'

export default async function CentroDeCostosPage() {
  const supabase = await createClient()
  const ownerId = await getDataOwnerId(supabase)
  if (!ownerId) redirect('/auth/login')

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
        Visualiza el costo total asignado por contenedor, producto o pallet, el costo por kilo
        y el margen real cruzando los gastos con los datos de producción.
      </p>
      <AnalisisCostosView clienteId={ownerId} />
    </div>
  )
}

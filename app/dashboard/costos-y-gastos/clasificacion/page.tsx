import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDataOwnerId } from '@/lib/supabase/effective-user-server'
import { getViewAsContext } from '@/lib/impersonation'
import {
  obtenerGastosPorContraparte,
  obtenerPeriodosGastos,
} from '@/app/actions/costos-gastos'
import { ClasificacionView } from '@/components/dashboard/costos-y-gastos/clasificacion-view'

export const dynamic = 'force-dynamic'

export default async function ClasificacionPage() {
  const supabase = await createClient()
  const ownerId = await getDataOwnerId(supabase)
  if (!ownerId) redirect('/auth/login')

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const viewAs = await getViewAsContext()
  const isAdmin = profile?.role === 'admin' && !viewAs.viewAsUserId

  const [result, periodosRes] = await Promise.all([
    obtenerGastosPorContraparte(ownerId),
    obtenerPeriodosGastos(ownerId),
  ])

  return (
    <ClasificacionView
      clienteId={ownerId}
      initialGastos={result.ok ? result.data : []}
      periodos={periodosRes.ok ? periodosRes.periodos : []}
      isAdmin={isAdmin || profile?.role === 'admin'}
      errorMessage={!result.ok ? result.message : undefined}
    />
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDataOwnerId } from '@/lib/supabase/effective-user-server'
import { calcularCapacidadPorReceta, obtenerMetaInventario } from '@/app/actions/produccion'
import { WidgetAlertasProduccion } from '@/components/dashboard/produccion/widget-alertas-produccion'
import { ProduccionPageHeader } from '@/components/dashboard/produccion/produccion-page-header'
import { ProduccionLoadError } from '@/components/dashboard/produccion/produccion-load-error'

export const dynamic = 'force-dynamic'

export default async function ProduccionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const ownerId = await getDataOwnerId(supabase)
  if (!ownerId) redirect('/auth/login')

  const [{ ok, data, message }, meta] = await Promise.all([
    calcularCapacidadPorReceta(ownerId),
    obtenerMetaInventario(ownerId),
  ])

  const critCount = data.filter((r) => r.estado_alerta === 'critico').length
  const bajCount = data.filter((r) => r.estado_alerta === 'bajo').length

  return (
    <div className="space-y-6">
      <ProduccionPageHeader
        critCount={critCount}
        bajCount={bajCount}
        showBanner={ok && data.length > 0}
      />

      {!ok ? (
        <ProduccionLoadError message={message} />
      ) : (
        <WidgetAlertasProduccion data={data} updatedAt={meta.updated_at} />
      )}
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDataOwnerId } from '@/lib/supabase/effective-user-server'
import { calcularCapacidadPorReceta, obtenerMetaInventario } from '@/app/actions/produccion'
import { UMBRAL_CRITICO_PALLETS, UMBRAL_BAJO_PALLETS } from '@/lib/produccion/constants'
import { WidgetAlertasProduccion } from '@/components/dashboard/produccion/widget-alertas-produccion'
import { Package, RefreshCw } from 'lucide-react'

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
  const bajCount  = data.filter((r) => r.estado_alerta === 'bajo').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Planificación de Producción</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Capacidad de armado por código de embalaje según stock disponible
          </p>
        </div>

        <a
          href="/dashboard/produccion"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </a>
      </div>

      {ok && data.length > 0 && (critCount > 0 || bajCount > 0) && (
        <div className="rounded-xl border border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-950/20 p-4 flex items-start gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="font-semibold text-red-900 dark:text-red-200 text-sm">
              Atención: {critCount + bajCount} código{critCount + bajCount > 1 ? 's' : ''} con stock insuficiente
            </p>
            <p className="text-xs text-red-700/90 dark:text-red-300/70 mt-0.5">
              {critCount > 0 && `${critCount} crítico${critCount > 1 ? 's' : ''} (< ${UMBRAL_CRITICO_PALLETS} pallets) · `}
              {bajCount > 0 && `${bajCount} bajo${bajCount > 1 ? 's' : ''} (< ${UMBRAL_BAJO_PALLETS} pallets)`}
            </p>
          </div>
        </div>
      )}

      {!ok ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive-foreground">{message ?? 'Error al cargar datos.'}</p>
        </div>
      ) : (
        <WidgetAlertasProduccion data={data} updatedAt={meta.updated_at} />
      )}
    </div>
  )
}

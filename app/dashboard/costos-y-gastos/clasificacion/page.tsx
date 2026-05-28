import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDataOwnerId } from '@/lib/supabase/effective-user-server'
import { obtenerGastosPorContraparte } from '@/app/actions/costos-gastos'
import { GastosDashboard } from '@/components/dashboard/costos-y-gastos/gastos-dashboard'
import { TrendingDown, Clock, Building2, FileX, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  accent?: 'primary' | 'amber' | 'emerald'
}) {
  const colorMap = {
    primary: 'bg-primary/10 border-primary/20 text-primary',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
  }
  const iconClass = colorMap[accent ?? 'primary']

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
      <div className={`shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center ${iconClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-foreground mt-0.5 tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6">
        <FileX className="w-9 h-9 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">Sin registros de gastos</h2>
      <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
        Aún no hay datos importados para este período. El administrador puede cargar el
        Libro de Compras SII desde el panel de gestión.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground text-sm hover:bg-muted transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al inicio
      </Link>
    </div>
  )
}

export default async function ClasificacionPage() {
  const supabase = await createClient()
  const ownerId = await getDataOwnerId(supabase)
  if (!ownerId) redirect('/auth/login')

  const result = await obtenerGastosPorContraparte(ownerId)
  const gastos = result.ok ? result.data : []

  const totalGasto      = gastos.reduce((s, c) => s + Number(c.total_monto_bruto), 0)
  const totalPendientes = gastos.reduce((s, c) => s + Number(c.pendientes), 0)
  const totalRegistros  = gastos.reduce((s, c) => s + Number(c.total_registros), 0)

  return (
    <div className="space-y-8">
      {gastos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            icon={TrendingDown}
            label="Gasto total acumulado"
            value={formatCLP(totalGasto)}
            sub={`${totalRegistros} documentos`}
            accent="primary"
          />
          <KpiCard
            icon={Building2}
            label="Contrapartes"
            value={String(gastos.length)}
            sub="proveedores únicos"
            accent="emerald"
          />
          <KpiCard
            icon={Clock}
            label="Documentos pendientes"
            value={String(totalPendientes)}
            sub={totalPendientes === 0 ? 'Todo clasificado' : 'por clasificar'}
            accent={totalPendientes > 0 ? 'amber' : 'emerald'}
          />
        </div>
      )}

      {gastos.length === 0 ? (
        <EmptyState />
      ) : (
        <GastosDashboard gastos={gastos} clienteId={ownerId} />
      )}

      {!result.ok && result.message && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {result.message}
        </div>
      )}
    </div>
  )
}

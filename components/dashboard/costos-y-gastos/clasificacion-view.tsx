'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  obtenerGastosPorContraparte,
  type GastoPorContraparte,
} from '@/app/actions/costos-gastos'
import { GastosDashboard } from './gastos-dashboard'
import { CostosWorkflowStepper } from './costos-workflow-stepper'
import { TrendingDown, Clock, Building2, FileX, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatPeriodoLabel(mes: string): string {
  if (/^\d{4}-\d{2}$/.test(mes)) {
    const [y, m] = mes.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
  }
  return mes
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

interface Props {
  clienteId: string
  initialGastos: GastoPorContraparte[]
  periodos: string[]
  isAdmin: boolean
  errorMessage?: string
}

export function ClasificacionView({
  clienteId,
  initialGastos,
  periodos,
  isAdmin,
  errorMessage,
}: Props) {
  const router = useRouter()
  const [gastos, setGastos] = useState(initialGastos)
  const [mesFilter, setMesFilter] = useState<string>('todos')
  const [pending, startTransition] = useTransition()

  const reload = useCallback((mes: string) => {
    startTransition(async () => {
      const res = await obtenerGastosPorContraparte(
        clienteId,
        mes !== 'todos' ? { mesDevengo: mes } : undefined,
      )
      if (res.ok) setGastos(res.data)
      router.refresh()
    })
  }, [clienteId, router])

  const handlePeriodChange = (value: string) => {
    setMesFilter(value)
    reload(value)
  }

  const totalGasto = useMemo(
    () => gastos.reduce((s, c) => s + Number(c.total_monto_bruto), 0),
    [gastos],
  )
  const totalPendientes = useMemo(
    () => gastos.reduce((s, c) => s + Number(c.pendientes), 0),
    [gastos],
  )
  const totalRegistros = useMemo(
    () => gastos.reduce((s, c) => s + Number(c.total_registros), 0),
    [gastos],
  )
  const totalClasificados = totalRegistros - totalPendientes
  const pctClasificado = totalRegistros > 0 ? Math.round((totalClasificados / totalRegistros) * 100) : 0

  return (
    <div className="space-y-6">
      <CostosWorkflowStepper clienteId={clienteId} />

      {periodos.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-sm text-muted-foreground shrink-0">Período de devengo</label>
          <Select value={mesFilter} onValueChange={handlePeriodChange} disabled={pending}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Todos los períodos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los períodos</SelectItem>
              {periodos.map((p) => (
                <SelectItem key={p} value={p}>{formatPeriodoLabel(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      )}

      {gastos.length > 0 && (
        <>
          <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <p className="text-sm font-medium text-foreground">
                Progreso de clasificación
              </p>
              <p className="text-xs text-muted-foreground">
                {totalClasificados} de {totalRegistros} documentos ({pctClasificado}%)
              </p>
            </div>
            <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${pctClasificado}%` }}
              />
            </div>
          </div>

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
        </>
      )}

      {gastos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6">
            <FileX className="w-9 h-9 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Sin registros de gastos</h2>
          <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
            {mesFilter !== 'todos'
              ? `No hay documentos para el período seleccionado. Prueba otro mes o "Todos los períodos".`
              : isAdmin
                ? 'Importa el Libro de Compras SII desde Admin → Clientes → Costos y Gastos.'
                : 'Tu administrador aún no ha cargado el Libro de Compras SII para este período.'}
          </p>
          {isAdmin ? (
            <Link
              href="/admin?tab=clientes"
              className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              Ir a importar datos
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio
            </Link>
          )}
        </div>
      ) : (
        <GastosDashboard gastos={gastos} clienteId={clienteId} />
      )}

      {errorMessage && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}
    </div>
  )
}

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
import { useLocale } from '@/components/i18n/locale-provider'

function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatPeriodoLabel(mes: string, locale: string): string {
  if (/^\d{4}-\d{2}$/.test(mes)) {
    const [y, m] = mes.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-CL', { month: 'long', year: 'numeric' })
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
  const { t, locale } = useLocale()
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
          <label className="text-sm text-muted-foreground shrink-0">{t('costosGastos.clasificacion.periodo.label')}</label>
          <Select value={mesFilter} onValueChange={handlePeriodChange} disabled={pending}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder={t('costosGastos.clasificacion.periodo.all')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t('costosGastos.clasificacion.periodo.all')}</SelectItem>
              {periodos.map((p) => (
                <SelectItem key={p} value={p}>{formatPeriodoLabel(p, locale)}</SelectItem>
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
                {t('costosGastos.clasificacion.progress.title')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('costosGastos.clasificacion.progress.summary', {
                  classified: totalClasificados,
                  total: totalRegistros,
                  pct: pctClasificado,
                })}
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
              label={t('costosGastos.clasificacion.kpi.gastoTotal')}
              value={formatCLP(totalGasto)}
              sub={t('costosGastos.clasificacion.kpi.documentosCount', { count: totalRegistros })}
              accent="primary"
            />
            <KpiCard
              icon={Building2}
              label={t('costosGastos.clasificacion.kpi.contrapartes')}
              value={String(gastos.length)}
              sub={t('costosGastos.clasificacion.kpi.proveedoresUnicos')}
              accent="emerald"
            />
            <KpiCard
              icon={Clock}
              label={t('costosGastos.clasificacion.kpi.pendientes')}
              value={String(totalPendientes)}
              sub={totalPendientes === 0 ? t('costosGastos.clasificacion.kpi.todoClasificado') : t('costosGastos.clasificacion.kpi.porClasificar')}
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
          <h2 className="text-xl font-semibold text-foreground mb-2">{t('costosGastos.clasificacion.noRecords.title')}</h2>
          <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
            {mesFilter !== 'todos'
              ? t('costosGastos.clasificacion.noRecords.periodEmpty')
              : isAdmin
                ? t('costosGastos.clasificacion.noRecords.adminHint')
                : t('costosGastos.clasificacion.noRecords.userHint')}
          </p>
          {isAdmin ? (
            <Link
              href="/admin?tab=clientes"
              className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              {t('costosGastos.clasificacion.noRecords.goImport')}
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('costosGastos.clasificacion.noRecords.backHome')}
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

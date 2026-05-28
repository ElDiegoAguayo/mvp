'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { obtenerResumenCostosWorkflow } from '@/app/actions/costos-gastos'

interface Props {
  clienteId: string
}

const STEPS = [
  { id: 'import', label: 'Importar SII', href: null as string | null },
  { id: 'clasificar', label: 'Clasificar', href: '/dashboard/costos-y-gastos/clasificacion' },
  { id: 'centros', label: 'Centro de Costos', href: '/dashboard/costos-y-gastos/centro-de-costos' },
] as const

export function CostosWorkflowStepper({ clienteId }: Props) {
  const pathname = usePathname()
  const [summary, setSummary] = useState({ totalRegistros: 0, pendientes: 0, clasificados: 0 })

  useEffect(() => {
    obtenerResumenCostosWorkflow(clienteId).then((res) => {
      if (res.ok) setSummary(res.data)
    })
  }, [clienteId, pathname])

  const pct =
    summary.totalRegistros > 0
      ? Math.round((summary.clasificados / summary.totalRegistros) * 100)
      : 0

  const currentStep =
    pathname.includes('centro-de-costos') ? 2 :
    pathname.includes('clasificacion') ? 1 : 1

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Flujo de trabajo
        </p>
        {summary.totalRegistros > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{summary.clasificados}</span>
            {' de '}
            <span className="font-semibold text-foreground">{summary.totalRegistros}</span>
            {' documentos clasificados '}
            <span className="text-primary font-semibold">({pct}%)</span>
          </p>
        )}
      </div>

      {summary.totalRegistros > 0 && (
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
        {STEPS.map((step, idx) => {
          const done =
            idx === 0 ? summary.totalRegistros > 0 :
            idx === 1 ? summary.pendientes === 0 && summary.clasificados > 0 :
            summary.clasificados > 0
          const active = idx === currentStep
          const Icon = done ? CheckCircle2 : Circle

          const inner = (
            <>
              <Icon className={cn('w-3.5 h-3.5 shrink-0', done ? 'text-emerald-500' : active ? 'text-primary' : 'text-muted-foreground/50')} />
              <span className={cn(
                'text-xs font-medium',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}>
                {step.label}
              </span>
              {idx === 1 && summary.pendientes > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold">
                  {summary.pendientes} pend.
                </span>
              )}
            </>
          )

          return (
            <div key={step.id} className="flex items-center gap-1 sm:gap-2">
              {step.href ? (
                <Link
                  href={step.href}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors',
                    active ? 'bg-primary/10 border border-primary/20' : 'hover:bg-secondary',
                  )}
                >
                  {inner}
                </Link>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-muted-foreground">
                  {inner}
                </span>
              )}
              {idx < STEPS.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 hidden sm:block" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
